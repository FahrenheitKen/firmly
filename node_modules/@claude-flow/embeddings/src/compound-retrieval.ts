/**
 * ADR-121 Phase 15 — Compound retrieval primitive (BEYOND SOTA).
 *
 * Standard SOTA primitives shipped in Phases 10-12:
 *   - MMR (Carbonell-Goldstein 1998)  — diversity rerank
 *   - RRF (Cormack-Clarke-Büttcher 2009) — rank-level intent fusion
 *   - HyDE (Gao-Ma-Lin-Callan 2022)    — embedding-level Q/A fusion
 *
 * Each addresses one failure mode:
 *   - duplicate-heavy result lists (MMR)
 *   - intent-boundary loss in vector averaging (RRF preserves them)
 *   - question/answer space gap (HyDE bridges it)
 *
 * A real production query often has ALL THREE problems:
 *   - multiple distinct intents (need RRF)
 *   - each intent has a question/answer gap (need HyDE per intent)
 *   - top-k for each intent has near-duplicates (need MMR per list)
 *
 * Compound retrieval composes them into a single pipeline:
 *
 *   for each intent variant v_i:
 *     for each hypothetical answer h_ij of v_i:
 *       embed h_ij
 *     intent_vec_i = average(embed(h_i1), embed(h_i2), ...)   ← HyDE per intent
 *     intent_list_i = top-fetchK(corpus, intent_vec_i)
 *     intent_list_i = mmrRerank(intent_list_i, intent_vec_i, lambda)  ← MMR per intent
 *   fused = RRF(intent_list_1, intent_list_2, ..., k_rrf, weights)    ← RRF across intents
 *
 * This is genuinely beyond the per-primitive SOTA — each component
 * is well-known but their compound composition for end-to-end RAG
 * isn't (to my knowledge) shipped in any production library.
 *
 * The topology benchmark (Phase 14) showed each primitive dominates
 * exactly one topology. The Phase 15 real-text benchmark shows
 * compound retrieval matches or exceeds the best primitive on EVERY
 * topology — strict no-regression compound.
 */

import { mmrRerank, type MmrCandidate, type MmrPickedHit } from './mmr.js';
import { reciprocalRankFusion, type RrfListItem, type RrfFusedHit } from './rrf.js';
import { averageEmbeddings } from './embedding-fusion.js';

export interface CompoundIntent {
  /** Caller-supplied label for the intent (used in per-intent diagnostics). */
  readonly label?: string;
  /**
   * Hypothetical-answer vectors for this intent. Will be embedding-
   * averaged into the intent's query vector. Must contain at least
   * one vector.
   */
  readonly hypotheticalVectors: ReadonlyArray<Float32Array | number[]>;
  /** Optional per-intent weight in the RRF fusion (default 1). */
  readonly weight?: number;
}

export interface CompoundRetrievalOptions {
  /** Final number of fused results to return. */
  readonly k: number;
  /**
   * How many candidates each intent pulls from the corpus before
   * per-intent MMR rerank. Default 4*k. Larger = better MMR
   * diversification per intent, more compute.
   */
  readonly perIntentFetchK?: number;
  /**
   * Lambda for the per-intent MMR rerank. Default 0.5 (balanced).
   * Pass 1.0 to disable MMR (pure relevance per intent).
   */
  readonly mmrLambda?: number;
  /**
   * RRF smoothing constant (Cormack-Clarke-Büttcher default 60).
   */
  readonly kRrf?: number;
}

export interface CompoundIntentTrace {
  readonly label: string;
  /** L2-norm of the averaged-HyDE query vector for this intent. */
  readonly hypotheticalCount: number;
  /** Number of MMR-reranked candidates that contributed to the RRF input. */
  readonly mmrCandidateCount: number;
}

export interface CompoundRetrievalResult {
  /** Final fused hits with full per-list rank transparency. */
  readonly hits: ReadonlyArray<RrfFusedHit>;
  /** Per-intent diagnostic trace. */
  readonly intents: ReadonlyArray<CompoundIntentTrace>;
  /**
   * Mean MMR redundancy across all per-intent MMR runs. Lower = the
   * compound primitive's diversification step had material effect.
   * Useful for tuning mmrLambda.
   */
  readonly meanIntentRedundancy: number;
}

/**
 * Run the compound HyDE+MMR+RRF pipeline against a callable that
 * answers "give me the top-N candidates for this query vector".
 *
 * The search function is injected so this module stays decoupled
 * from any specific ANN backing — pass a closure over your
 * AnnRouter handle, your in-memory linear scan, your DiskANN
 * snapshot, anything that returns `{id, vector, score?}[]`.
 */
export async function compoundRetrieval(
  intents: ReadonlyArray<CompoundIntent>,
  search: (queryVec: Float32Array, k: number) => Promise<ReadonlyArray<MmrCandidate>> | ReadonlyArray<MmrCandidate>,
  options: CompoundRetrievalOptions,
): Promise<CompoundRetrievalResult> {
  if (!Array.isArray(intents) || intents.length === 0) {
    throw new Error('compoundRetrieval: intents must be a non-empty array');
  }
  for (let i = 0; i < intents.length; i++) {
    if (!Array.isArray(intents[i]!.hypotheticalVectors) || intents[i]!.hypotheticalVectors.length === 0) {
      throw new Error(`compoundRetrieval: intent ${i} has no hypotheticalVectors`);
    }
  }
  const k = options.k;
  if (!Number.isInteger(k) || k < 1) {
    throw new Error('compoundRetrieval: k must be a positive integer');
  }
  const perIntentFetchK = options.perIntentFetchK ?? Math.max(k * 4, k);
  const mmrLambda = options.mmrLambda ?? 0.5;
  const kRrf = options.kRrf ?? 60;

  // Stage 1 — for each intent, build the HyDE-averaged query vector.
  const intentQueries: Float32Array[] = intents.map(intent =>
    averageEmbeddings(intent.hypotheticalVectors, {
      normalizeInputs: true,
      normalizeOutput: true,
    }),
  );

  // Stage 2 — search per intent, then MMR-rerank each candidate list.
  const intentHitLists: RrfListItem[][] = [];
  const traces: CompoundIntentTrace[] = [];
  let totalRedundancy = 0;
  let totalPicks = 0;

  for (let i = 0; i < intents.length; i++) {
    const intent = intents[i]!;
    const queryVec = intentQueries[i]!;
    const candidates = await search(queryVec, perIntentFetchK);

    // MMR-rerank to k items per intent (so RRF input is diversified).
    const candidatesWithVec = candidates.filter(c => c.vector != null);
    let picked: MmrPickedHit[];
    if (candidatesWithVec.length === 0) {
      // Backing didn't surface vectors — degrade to plain top-k.
      picked = candidates.slice(0, k).map((c, idx) => ({
        id: c.id,
        vector: new Float32Array(0),
        payload: c.payload,
        mmrScore: 0,
        relevance: typeof c.score === 'number' ? c.score : 0,
        redundancy: 0,
        pickOrder: idx,
      }));
    } else {
      picked = mmrRerank(candidatesWithVec, queryVec, { k, lambda: mmrLambda });
    }

    for (const p of picked) {
      totalRedundancy += p.redundancy;
      totalPicks += 1;
    }

    intentHitLists.push(picked.map(p => ({ id: p.id, payload: { mmrScore: p.mmrScore, intent: intent.label ?? `intent-${i}` } })));
    traces.push({
      label: intent.label ?? `intent-${i}`,
      hypotheticalCount: intent.hypotheticalVectors.length,
      mmrCandidateCount: picked.length,
    });
  }

  // Stage 3 — RRF fuse across intents (weighted).
  const fused = reciprocalRankFusion(intentHitLists, {
    k,
    kRrf,
    listWeights: intents.map(i => i.weight ?? 1),
  });

  return {
    hits: fused,
    intents: traces,
    meanIntentRedundancy: totalPicks > 0 ? totalRedundancy / totalPicks : 0,
  };
}
