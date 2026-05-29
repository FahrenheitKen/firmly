/**
 * ADR-121 Phase 13 — Standard IR evaluation metrics.
 *
 * These are the metrics every retrieval benchmark reports: recall@k,
 * precision@k, mean reciprocal rank (MRR), and normalized discounted
 * cumulative gain (nDCG@k). Used by the RAG benchmark harness to
 * compare the 5 search_text_* primitives on the same corpus.
 *
 * Definitions (standard IR textbook):
 *
 *   recall@k    = |relevant ∩ retrieved_top_k| / |relevant|
 *   precision@k = |relevant ∩ retrieved_top_k| / k
 *   reciprocal rank = 1 / rank_of_first_relevant  (0 if none in top-k)
 *   MRR         = mean of reciprocal ranks over a query set
 *
 *   DCG@k  = Σ_{i=1..k}  rel_i / log2(i + 1)         (binary or graded)
 *   IDCG@k = DCG@k of the ideal ordering (relevant items first)
 *   nDCG@k = DCG@k / IDCG@k    (0..1; 1 = perfect ordering)
 *
 * Inputs are intentionally generic: each metric takes a retrieved-id
 * list and either a relevant-id set (binary judgements) or a
 * id→relevance-grade map (graded judgements). No coupling to the
 * retrieval tools — anything that produces a ranked list of ids can
 * be evaluated.
 */

export type RelevanceSet = ReadonlySet<string> | ReadonlyArray<string>;
export type GradedRelevance = ReadonlyMap<string, number> | Readonly<Record<string, number>>;

function toSet(rel: RelevanceSet): Set<string> {
  if (rel instanceof Set) return rel as Set<string>;
  return new Set(rel as ReadonlyArray<string>);
}

function gradeOf(rel: GradedRelevance, id: string): number {
  if (rel instanceof Map) return rel.get(id) ?? 0;
  return (rel as Record<string, number>)[id] ?? 0;
}

/**
 * recall@k = how much of the relevant set we found in the top-k.
 * Returns 0 when relevant is empty (no signal to recall).
 */
export function recallAtK(
  retrieved: ReadonlyArray<string>,
  relevant: RelevanceSet,
  k: number,
): number {
  const relSet = toSet(relevant);
  if (relSet.size === 0) return 0;
  const topK = retrieved.slice(0, Math.max(0, k));
  let hits = 0;
  for (const id of topK) if (relSet.has(id)) hits++;
  return hits / relSet.size;
}

/**
 * precision@k = what fraction of the top-k is relevant. Returns 0
 * for k<=0.
 */
export function precisionAtK(
  retrieved: ReadonlyArray<string>,
  relevant: RelevanceSet,
  k: number,
): number {
  if (k <= 0) return 0;
  const relSet = toSet(relevant);
  const topK = retrieved.slice(0, k);
  let hits = 0;
  for (const id of topK) if (relSet.has(id)) hits++;
  return hits / k;
}

/**
 * Reciprocal rank: 1 / (1-based rank of first relevant item in the
 * retrieved list). 0 if no relevant item appears at all.
 */
export function reciprocalRank(
  retrieved: ReadonlyArray<string>,
  relevant: RelevanceSet,
): number {
  const relSet = toSet(relevant);
  for (let i = 0; i < retrieved.length; i++) {
    if (relSet.has(retrieved[i]!)) return 1 / (i + 1);
  }
  return 0;
}

/**
 * Mean reciprocal rank over a set of (retrieved, relevant) pairs.
 * The standard MRR over a query set.
 */
export function meanReciprocalRank(
  queries: ReadonlyArray<{ retrieved: ReadonlyArray<string>; relevant: RelevanceSet }>,
): number {
  if (queries.length === 0) return 0;
  let sum = 0;
  for (const q of queries) sum += reciprocalRank(q.retrieved, q.relevant);
  return sum / queries.length;
}

/**
 * DCG@k over GRADED judgements:
 *   DCG@k = Σ_{i=1..k} rel_i / log2(i + 1)
 * Treats missing ids as relevance 0.
 */
export function dcgAtK(
  retrieved: ReadonlyArray<string>,
  graded: GradedRelevance,
  k: number,
): number {
  if (k <= 0) return 0;
  const topK = retrieved.slice(0, k);
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const g = gradeOf(graded, topK[i]!);
    if (g > 0) dcg += g / Math.log2(i + 2); // i+2 because rank = i+1, denom = log2(rank+1)
  }
  return dcg;
}

/**
 * IDCG@k — ideal DCG: assumes the top-k contains the k highest-graded
 * items from the judgement pool.
 */
export function idcgAtK(graded: GradedRelevance, k: number): number {
  if (k <= 0) return 0;
  const grades: number[] = [];
  if (graded instanceof Map) {
    for (const v of graded.values()) if (v > 0) grades.push(v);
  } else {
    for (const v of Object.values(graded as Record<string, number>)) if (v > 0) grades.push(v);
  }
  grades.sort((a, b) => b - a);
  const top = grades.slice(0, k);
  let idcg = 0;
  for (let i = 0; i < top.length; i++) {
    idcg += top[i]! / Math.log2(i + 2);
  }
  return idcg;
}

/**
 * nDCG@k = DCG@k / IDCG@k, clamped to [0, 1]. Returns 0 when no
 * relevant items exist (IDCG is 0).
 *
 * Supports both binary judgements (pass a Set/Array → grade=1 each)
 * and graded judgements (pass a Map/Record).
 */
export function ndcgAtK(
  retrieved: ReadonlyArray<string>,
  judgements: RelevanceSet | GradedRelevance,
  k: number,
): number {
  if (k <= 0) return 0;
  // Coerce binary judgements to graded form.
  let graded: GradedRelevance;
  if (judgements instanceof Set || Array.isArray(judgements)) {
    const m = new Map<string, number>();
    for (const id of judgements as Iterable<string>) m.set(id, 1);
    graded = m;
  } else {
    graded = judgements as GradedRelevance;
  }
  const idcg = idcgAtK(graded, k);
  if (idcg === 0) return 0;
  return Math.min(1, dcgAtK(retrieved, graded, k) / idcg);
}

/**
 * Compare a ranking against judgements across MULTIPLE k values in
 * one pass. Standard benchmarking pattern — `recall@1 / 5 / 10` plus
 * `nDCG@1 / 5 / 10` plus MRR all in a single call. Cheaper than
 * calling each metric N times.
 *
 * Returns:
 *   {
 *     recall:   { 1: number, 5: number, 10: number, ... },
 *     ndcg:     { 1: number, 5: number, 10: number, ... },
 *     precision:{ 1: number, 5: number, 10: number, ... },
 *     mrr: number,
 *   }
 */
export interface RankingComparison {
  readonly recall: Readonly<Record<number, number>>;
  readonly precision: Readonly<Record<number, number>>;
  readonly ndcg: Readonly<Record<number, number>>;
  readonly mrr: number;
}

export function compareRankings(
  retrieved: ReadonlyArray<string>,
  judgements: RelevanceSet | GradedRelevance,
  ks: ReadonlyArray<number>,
): RankingComparison {
  // Coerce judgements into a usable form for both binary + graded paths.
  let relSet: Set<string>;
  let graded: GradedRelevance;
  if (judgements instanceof Set) {
    relSet = judgements as Set<string>;
    const m = new Map<string, number>();
    for (const id of relSet) m.set(id, 1);
    graded = m;
  } else if (Array.isArray(judgements)) {
    relSet = new Set(judgements as ReadonlyArray<string>);
    const m = new Map<string, number>();
    for (const id of relSet) m.set(id, 1);
    graded = m;
  } else {
    graded = judgements as GradedRelevance;
    relSet = new Set<string>();
    if (graded instanceof Map) {
      for (const [id, g] of graded) if (g > 0) relSet.add(id);
    } else {
      for (const [id, g] of Object.entries(graded as Record<string, number>)) {
        if (g > 0) relSet.add(id);
      }
    }
  }

  const recall: Record<number, number> = {};
  const precision: Record<number, number> = {};
  const ndcg: Record<number, number> = {};
  for (const k of ks) {
    recall[k] = recallAtK(retrieved, relSet, k);
    precision[k] = precisionAtK(retrieved, relSet, k);
    ndcg[k] = ndcgAtK(retrieved, graded, k);
  }
  const mrr = reciprocalRank(retrieved, relSet);
  return { recall, precision, ndcg, mrr };
}

/**
 * Convenience: roll up a metric over a query set (mean across queries).
 * Skips queries with empty relevant sets (no signal).
 */
export function meanMetric(
  queries: ReadonlyArray<{ retrieved: ReadonlyArray<string>; relevant: RelevanceSet | GradedRelevance }>,
  metric: (retrieved: ReadonlyArray<string>, judgements: RelevanceSet | GradedRelevance) => number,
): number {
  if (queries.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const q of queries) {
    const relSize = q.relevant instanceof Set || Array.isArray(q.relevant)
      ? (q.relevant as { size?: number; length?: number }).size ?? (q.relevant as ArrayLike<string>).length
      : q.relevant instanceof Map ? q.relevant.size : Object.keys(q.relevant as object).length;
    if (relSize === 0) continue;
    sum += metric(q.retrieved, q.relevant);
    count++;
  }
  return count === 0 ? 0 : sum / count;
}
