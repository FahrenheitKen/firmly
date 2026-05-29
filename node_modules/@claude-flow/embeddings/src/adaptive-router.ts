/**
 * ADR-121 Phase 16 — Adaptive primitive selection (BEYOND SOTA).
 *
 * Phase 14's topology benchmark proved each RAG primitive dominates
 * exactly one corpus shape:
 *
 *   easy            → plain wins (no fusion needed)
 *   duplicate-heavy → MMR wins on subtopic-coverage
 *   multi-intent    → RRF wins on intent-boundary preservation
 *   q-a-gap         → HyDE wins on centroid-finding
 *
 * Production RAG systems don't route between primitives automatically
 * — they pick one pipeline at design time or run all-of-them and
 * vote/reduce. Both choices leave performance on the table.
 *
 * This module ships **adaptive primitive selection**: extract three
 * cheap signals from the candidate set + query variants + hypothetical
 * answers, then pick the right primitive (or the compound) based on
 * which signals fire. Cost: one extra small-fan cosine pass over the
 * candidate set and the variant/hypothetical embeddings.
 *
 * Signals:
 *
 *   1. duplicateDensity — mean pairwise cosine among the top-N
 *      candidates from a plain search. High = corpus has near-dup
 *      structure → MMR signal.
 *
 *   2. queryIntentCohesion — mean pairwise cosine among the query
 *      reformulation vectors. Low = reformulations cover distinct
 *      intents → RRF signal.
 *
 *   3. qaSpaceGap — 1 - cosine(question_vector, mean(hypothetical_vectors)).
 *      High = the question and the hypothetical answers live in
 *      different vector regions → HyDE signal.
 *
 * The router applies a small set of thresholds (defaults from the
 * Phase 14 topology data) and returns a structured decision the
 * caller can act on or override.
 */

export interface RetrievalFeatures {
  /** Mean pairwise cosine among top-N candidates from a plain search. Range [-1, 1]. Higher = more duplicate-like. */
  readonly duplicateDensity: number;
  /** Mean pairwise cosine among query reformulation vectors. Range [-1, 1]. Higher = more cohesive (single intent). */
  readonly queryIntentCohesion: number;
  /** 1 - cosine(question_vec, mean(hypothetical_vecs)). Range [0, 2]. Higher = larger Q/A space gap. */
  readonly qaSpaceGap: number;
  /**
   * Phase 17 — Mean IDF of unique query tokens (relative to a BM25
   * index over the corpus). Higher = query has rare/technical
   * tokens that dense embeddings tend to underweight → hybrid
   * sparse+dense retrieval wins. 0 when no BM25 index was provided.
   */
  readonly rareTokenDensity: number;
  /** How many top candidates were used to compute duplicateDensity. */
  readonly candidateCountUsed: number;
  /** How many variants were used to compute intent cohesion. */
  readonly variantCount: number;
  /** How many hypotheticals were used to compute Q/A gap. */
  readonly hypotheticalCount: number;
  /** True if the caller provided a BM25 index for rareTokenDensity. */
  readonly bm25IndexProvided: boolean;
}

export interface AdaptiveRouterOptions {
  /**
   * Threshold above which duplicateDensity triggers the MMR signal.
   * Default 0.85 — duplicates are very close to each other in
   * cosine space.
   */
  readonly duplicateThreshold?: number;
  /**
   * Threshold below which queryIntentCohesion triggers the RRF
   * signal. Default 0.55 — orthogonal-ish reformulations.
   */
  readonly intentCohesionThreshold?: number;
  /**
   * Threshold above which qaSpaceGap triggers the HyDE signal.
   * Default 0.35 — meaningful question/answer space drift.
   */
  readonly qaGapThreshold?: number;
  /**
   * Phase 17 — Threshold above which rareTokenDensity (mean query IDF)
   * triggers the HYBRID signal. Default 2.0 — IDF ≥ 2.0 means the
   * query's tokens appear in <~13% of the corpus, where BM25's
   * sparse lexical signal materially helps dense retrieval.
   */
  readonly rareTokenThreshold?: number;
  /**
   * If 2+ signals fire, return `compound` instead of one of the
   * individual primitives. Default true.
   */
  readonly preferCompoundWhenMultipleSignals?: boolean;
}

export type AdaptivePrimitive = 'plain' | 'mmr' | 'rrf' | 'hyde' | 'hybrid' | 'compound';

export interface AdaptiveDecision {
  /** The recommended primitive. */
  readonly primitive: AdaptivePrimitive;
  /** Human-readable explanation citing which signals fired. */
  readonly reason: string;
  /** Which signals were above their respective thresholds. */
  readonly signals: Readonly<{ mmr: boolean; rrf: boolean; hyde: boolean; hybrid: boolean }>;
  /** Echo of the input features for traceability. */
  readonly features: RetrievalFeatures;
}

function cosineSim(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function meanPairwiseCosine(vectors: ReadonlyArray<Float32Array | number[]>): number {
  if (vectors.length < 2) return 0;
  let total = 0, pairs = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      total += cosineSim(vectors[i]!, vectors[j]!);
      pairs++;
    }
  }
  return total / pairs;
}

function meanVector(vectors: ReadonlyArray<Float32Array | number[]>): Float32Array {
  const dim = vectors[0]!.length;
  const out = new Float32Array(dim);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) out[i]! += v[i]!;
  }
  for (let i = 0; i < dim; i++) out[i]! /= vectors.length;
  return out;
}

/**
 * Extract the routing signals from the available inputs.
 *
 * @param topCandidates  — top-N hits from a cheap plain search,
 *                          with vectors. Used for duplicateDensity.
 *                          Pass `null` to disable that signal.
 * @param queryVector    — the user-question vector. Required for
 *                          qaSpaceGap.
 * @param variantVectors — N query reformulation vectors. Used for
 *                          queryIntentCohesion. At least 2 required
 *                          to compute the signal.
 * @param hypotheticalVectors — N hypothetical-answer vectors. Used
 *                          for qaSpaceGap. At least 1 required.
 * @param bm25Input — optional {queryText, bm25Index} pair for the
 *                          Phase 17 hybrid signal. Pass `null` to
 *                          disable.
 *
 * Cost: O(N²·dim) for the pairwise cosines + O(|q|) for the BM25
 * mean-IDF lookup.
 */
export function extractRetrievalFeatures(
  topCandidates: ReadonlyArray<{ vector: Float32Array | number[] }> | null,
  queryVector: Float32Array | number[],
  variantVectors: ReadonlyArray<Float32Array | number[]>,
  hypotheticalVectors: ReadonlyArray<Float32Array | number[]>,
  bm25Input?: { queryText: string; index: { df: ReadonlyMap<string, number>; N: number } } | null,
): RetrievalFeatures {
  // Duplicate density: pairwise cosine of top candidates.
  const candVecs = (topCandidates ?? []).map(c => c.vector);
  const duplicateDensity = meanPairwiseCosine(candVecs);

  // Intent cohesion: pairwise cosine of variants. Need >=2 to compute.
  const queryIntentCohesion = meanPairwiseCosine(variantVectors);

  // Q/A space gap: distance between question vector and mean of hypotheticals.
  let qaSpaceGap = 0;
  if (hypotheticalVectors.length > 0) {
    const mean = meanVector(hypotheticalVectors);
    qaSpaceGap = 1 - cosineSim(queryVector, mean);
  }

  // Phase 17 — rare-token density from BM25 mean IDF.
  let rareTokenDensity = 0;
  let bm25IndexProvided = false;
  if (bm25Input && bm25Input.index && typeof bm25Input.queryText === 'string') {
    bm25IndexProvided = true;
    // Inline the IDF computation to avoid an import cycle.
    const tokens = Array.from(new Set(
      bm25Input.queryText.toLowerCase().split(/[^a-z0-9]+/i).filter(t => t.length >= 2),
    ));
    const { df, N } = bm25Input.index;
    let total = 0;
    let counted = 0;
    for (const t of tokens) {
      const dfT = df.get(t) ?? 0;
      if (dfT === 0) continue;
      const idf = Math.log(((N - dfT + 0.5) / (dfT + 0.5)) + 1);
      total += idf;
      counted++;
    }
    rareTokenDensity = counted === 0 ? 0 : total / counted;
  }

  return {
    duplicateDensity,
    queryIntentCohesion,
    qaSpaceGap,
    rareTokenDensity,
    candidateCountUsed: candVecs.length,
    variantCount: variantVectors.length,
    hypotheticalCount: hypotheticalVectors.length,
    bm25IndexProvided,
  };
}

/**
 * Apply the routing heuristic to a set of features. Returns the
 * recommended primitive plus the reasoning trace.
 */
export function adaptiveRoute(
  features: RetrievalFeatures,
  options: AdaptiveRouterOptions = {},
): AdaptiveDecision {
  const dupT = options.duplicateThreshold ?? 0.85;
  const intentT = options.intentCohesionThreshold ?? 0.55;
  const gapT = options.qaGapThreshold ?? 0.35;
  const rareT = options.rareTokenThreshold ?? 2.0;
  const compound = options.preferCompoundWhenMultipleSignals ?? true;

  // Only fire a signal when the underlying input was actually present.
  const mmrSignal = features.candidateCountUsed >= 2 && features.duplicateDensity > dupT;
  const rrfSignal = features.variantCount >= 2 && features.queryIntentCohesion < intentT;
  const hydeSignal = features.hypotheticalCount >= 1 && features.qaSpaceGap > gapT;
  const hybridSignal = features.bm25IndexProvided && features.rareTokenDensity > rareT;

  const fireCount = (mmrSignal ? 1 : 0) + (rrfSignal ? 1 : 0) + (hydeSignal ? 1 : 0) + (hybridSignal ? 1 : 0);

  let primitive: AdaptivePrimitive;
  let reason: string;
  if (fireCount === 0) {
    primitive = 'plain';
    reason = `No signals fired (dup=${features.duplicateDensity.toFixed(3)}<=${dupT}, intentCohesion=${features.queryIntentCohesion.toFixed(3)}>=${intentT}, qaGap=${features.qaSpaceGap.toFixed(3)}<=${gapT}${features.bm25IndexProvided ? `, rareToken=${features.rareTokenDensity.toFixed(3)}<=${rareT}` : ''}); plain top-k is sufficient.`;
  } else if (fireCount >= 2 && compound) {
    primitive = 'compound';
    const fired = [
      mmrSignal ? `MMR(dup=${features.duplicateDensity.toFixed(3)}>${dupT})` : null,
      rrfSignal ? `RRF(intent=${features.queryIntentCohesion.toFixed(3)}<${intentT})` : null,
      hydeSignal ? `HyDE(qaGap=${features.qaSpaceGap.toFixed(3)}>${gapT})` : null,
      hybridSignal ? `Hybrid(rareToken=${features.rareTokenDensity.toFixed(3)}>${rareT})` : null,
    ].filter(Boolean).join(', ');
    reason = `Multiple signals fired: ${fired}; compound primitive composes them all.`;
  } else if (mmrSignal) {
    primitive = 'mmr';
    reason = `MMR signal fired: duplicateDensity=${features.duplicateDensity.toFixed(3)}>${dupT}; corpus has near-duplicate top candidates, diversity rerank wins.`;
  } else if (rrfSignal) {
    primitive = 'rrf';
    reason = `RRF signal fired: queryIntentCohesion=${features.queryIntentCohesion.toFixed(3)}<${intentT}; reformulations cover distinct intents, rank-fusion preserves boundaries.`;
  } else if (hydeSignal) {
    primitive = 'hyde';
    reason = `HyDE signal fired: qaSpaceGap=${features.qaSpaceGap.toFixed(3)}>${gapT}; question and hypothetical answers diverge in vector space, HyDE bridges the gap.`;
  } else {
    primitive = 'hybrid';
    reason = `Hybrid signal fired: rareTokenDensity=${features.rareTokenDensity.toFixed(3)}>${rareT}; query has rare/technical tokens that dense retrieval underweights, BM25 fusion recovers them.`;
  }

  return {
    primitive,
    reason,
    signals: { mmr: mmrSignal, rrf: rrfSignal, hyde: hydeSignal, hybrid: hybridSignal },
    features,
  };
}
