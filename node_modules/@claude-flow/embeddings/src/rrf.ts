/**
 * ADR-121 Phase 11 — Reciprocal Rank Fusion (RRF).
 *
 * When you have N ranked result lists for the same query (or for N
 * variants of the same intent) — e.g. from a question-reformulation
 * pipeline, from a hybrid lexical+vector search, or from multiple
 * embedding models — RRF combines them into a single fused ranking
 * without needing the underlying scores to be comparable.
 *
 * Cormack, Clarke, Büttcher (SIGIR 2009):
 *
 *   RRF_score(item) = Σ over lists i where item appears:  1 / (k_rrf + rank_i)
 *
 * where rank_i is the item's 1-based position in list i and k_rrf is a
 * small constant (the original paper recommends 60 — small enough that
 * top results dominate, large enough that mid-list ranks still
 * contribute). The score is heuristic but practically excellent: RRF
 * consistently matches or beats supervised learning-to-rank in TREC
 * evaluations despite needing zero training data.
 *
 * This module ships the algorithm as a pure function so callers can
 * compose it with any source of ranked lists — AnnRouter results,
 * lexical search, MMR-reranked picks, etc. The CLI's
 * `embeddings_search_text_ensemble` tool composes
 * `search_text_batch` + `reciprocalRankFusion` for the common case of
 * "expand one user query into N variants, retrieve top-k for each,
 * fuse to a single ranking".
 */

export interface RrfListItem {
  /** Caller-supplied identifier. Items with the same id across lists are fused. */
  readonly id: string;
  /** Free-form payload — preserved from the FIRST list this item appears in. */
  readonly payload?: unknown;
}

export interface RrfOptions {
  /** Number of fused results to return. Clamped to total unique items. */
  readonly k: number;
  /**
   * RRF smoothing constant. Default 60 (the SIGIR 2009 recommendation).
   * Smaller k_rrf → top-ranked items dominate more sharply.
   * Larger k_rrf → flatter contribution from each list, more like simple
   * vote-counting.
   */
  readonly kRrf?: number;
  /** Optional per-list weights. Default = 1 for every list. */
  readonly listWeights?: ReadonlyArray<number>;
}

export interface RrfFusedHit {
  readonly id: string;
  readonly payload?: unknown;
  /** Final fused RRF score (higher = better). */
  readonly score: number;
  /**
   * Per-list contribution: the 1-based rank in each list the item
   * appeared in. Length === number of input lists. `null` means the
   * item didn't appear in that list.
   */
  readonly ranks: ReadonlyArray<number | null>;
  /** Number of lists the item appeared in. */
  readonly listOccurrences: number;
}

/**
 * Iterative RRF over N ranked lists. Time complexity:
 *   O(N · L) where N = number of lists, L = avg list length
 *
 * Lists are 1-indexed inside the formula (first item = rank 1).
 */
export function reciprocalRankFusion(
  lists: ReadonlyArray<ReadonlyArray<RrfListItem>>,
  options: RrfOptions,
): RrfFusedHit[] {
  if (!Array.isArray(lists) || lists.length === 0) return [];
  const kRrf = options.kRrf ?? 60;
  if (kRrf <= 0) {
    throw new Error('kRrf must be > 0');
  }
  if (options.listWeights && options.listWeights.length !== lists.length) {
    throw new Error(
      `listWeights.length (${options.listWeights.length}) must match lists.length (${lists.length})`,
    );
  }
  const weights = options.listWeights ?? lists.map(() => 1);

  // id → accumulated fused state
  const acc = new Map<string, {
    payload: unknown;
    score: number;
    ranks: Array<number | null>;
    listOccurrences: number;
  }>();

  for (let i = 0; i < lists.length; i++) {
    const list = lists[i]!;
    const w = weights[i]!;
    for (let j = 0; j < list.length; j++) {
      const item = list[j]!;
      const rank = j + 1; // 1-based per SIGIR 2009
      const contribution = w / (kRrf + rank);
      const entry = acc.get(item.id);
      if (entry) {
        entry.score += contribution;
        entry.ranks[i] = rank;
        entry.listOccurrences += 1;
      } else {
        const ranks: Array<number | null> = new Array(lists.length).fill(null);
        ranks[i] = rank;
        acc.set(item.id, {
          payload: item.payload,
          score: contribution,
          ranks,
          listOccurrences: 1,
        });
      }
    }
  }

  // Sort by score desc, stable on id for determinism on ties.
  const sorted = Array.from(acc.entries())
    .map(([id, v]) => ({
      id,
      payload: v.payload,
      score: v.score,
      ranks: v.ranks,
      listOccurrences: v.listOccurrences,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const k = Math.max(0, Math.min(options.k, sorted.length));
  return sorted.slice(0, k);
}

/**
 * Convenience: same as reciprocalRankFusion but returns just the fused
 * ids in rank order.
 */
export function rrfIds(
  lists: ReadonlyArray<ReadonlyArray<RrfListItem>>,
  options: RrfOptions,
): string[] {
  return reciprocalRankFusion(lists, options).map(h => h.id);
}
