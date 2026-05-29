/**
 * ADR-121 Phase 15 — Synthetic topic-clustered corpus builder.
 *
 * Generates a deterministic, reproducible vector corpus with known
 * topic structure + known relevance judgements. Used by the RAG
 * scale benchmark and available as a pure-function utility for
 * users who want to benchmark their own retrieval pipelines without
 * sourcing real corpora.
 *
 * Topology: N topics × D docs per topic. Each topic has a "centroid"
 * direction in vector space; its docs are noisy variants near that
 * centroid. A configurable fraction of each topic's docs are
 * "duplicate-heavy" (very close to the centroid) — useful for
 * stressing diversification primitives. The remaining docs spread
 * along secondary axes for diversity.
 *
 * Determinism: same options → same corpus, bit-for-bit. Uses a
 * deterministic PRNG seeded by `seed` (default 42).
 */

export interface SyntheticCorpusOptions {
  /** Number of distinct topics. Each topic gets its own axis in vector space. */
  readonly topics: number;
  /** Docs per topic. Total corpus size = topics × docsPerTopic. */
  readonly docsPerTopic: number;
  /** Embedding dimension. Must be >= topics. */
  readonly dim: number;
  /**
   * Fraction of each topic's docs that are near-duplicate (very close
   * to the topic centroid). The rest spread along secondary axes for
   * diversity. Default 0.4 (40% dup-heavy, 60% diverse).
   * Range: [0, 1].
   */
  readonly duplicateRatio?: number;
  /**
   * Noise scale added to each doc vector. Default 0.05. Larger noise
   * makes topics less separable.
   */
  readonly noiseLevel?: number;
  /** PRNG seed. Same seed → identical corpus. Default 42. */
  readonly seed?: number;
}

export interface SyntheticCorpusEntry {
  readonly id: string;
  /** Topic this doc belongs to. */
  readonly topic: number;
  /** True if this is a near-duplicate (vs a diverse member of the topic). */
  readonly isDuplicate: boolean;
  /** L2-normalized vector. */
  readonly vector: Float32Array;
}

export interface SyntheticCorpus {
  readonly entries: ReadonlyArray<SyntheticCorpusEntry>;
  /** topic index → set of doc ids belonging to that topic */
  readonly relevantByTopic: ReadonlyArray<ReadonlySet<string>>;
  /** Canonical query vector for each topic (the topic's centroid direction). */
  readonly topicQueryVectors: ReadonlyArray<Float32Array>;
  readonly options: Required<SyntheticCorpusOptions>;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function l2Normalize(v: Float32Array): Float32Array {
  let sq = 0;
  for (let i = 0; i < v.length; i++) sq += v[i]! * v[i]!;
  if (sq === 0) return v;
  const inv = 1 / Math.sqrt(sq);
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! * inv;
  return out;
}

/**
 * Build a synthetic topic-clustered corpus.
 *
 * Time complexity: O(topics · docsPerTopic · dim). Memory: same.
 *
 * For each topic t in [0, topics):
 *   - centroid = unit vector with axis t = 1
 *   - dup docs: centroid + small noise (within duplicateRatio of total)
 *   - diverse docs: centroid + larger secondary-axis components + noise
 *   - all L2-normalized
 *
 * Returns:
 *   - entries: flat list of docs (interleaved by topic for shuffle resistance)
 *   - relevantByTopic[t]: set of doc IDs belonging to topic t
 *   - topicQueryVectors[t]: canonical query vector for topic t
 */
export function buildSyntheticTopicCorpus(
  options: SyntheticCorpusOptions,
): SyntheticCorpus {
  const topics = options.topics;
  const docsPerTopic = options.docsPerTopic;
  const dim = options.dim;
  const duplicateRatio = Math.max(0, Math.min(1, options.duplicateRatio ?? 0.4));
  const noiseLevel = options.noiseLevel ?? 0.05;
  const seed = options.seed ?? 42;

  if (topics <= 0) throw new Error('topics must be > 0');
  if (docsPerTopic <= 0) throw new Error('docsPerTopic must be > 0');
  if (dim < topics) throw new Error(`dim (${dim}) must be >= topics (${topics})`);

  const rng = mulberry32(seed);
  const dupCount = Math.round(docsPerTopic * duplicateRatio);
  const divCount = docsPerTopic - dupCount;

  const entries: SyntheticCorpusEntry[] = [];
  const relevantByTopic: Set<string>[] = Array.from({ length: topics }, () => new Set<string>());
  const topicQueryVectors: Float32Array[] = [];

  // Build canonical query vector per topic (one-hot on topic axis).
  for (let t = 0; t < topics; t++) {
    const q = new Float32Array(dim);
    q[t] = 1;
    topicQueryVectors.push(l2Normalize(q));
  }

  // Generate docs interleaved (round-robin by topic) so the entries
  // array isn't pre-grouped — exercises ANN insertion order
  // robustness.
  for (let d = 0; d < docsPerTopic; d++) {
    for (let t = 0; t < topics; t++) {
      const isDup = d < dupCount;
      const v = new Float32Array(dim);

      // Topic-axis signal
      v[t] = isDup ? 1.0 : 0.7;

      // For diverse docs, add a secondary-axis signal so they spread.
      if (!isDup) {
        // Pick a secondary axis deterministically by (topic, d)
        const secondaryAxis = ((t + d + 1) * 7) % dim;
        if (secondaryAxis !== t) {
          v[secondaryAxis] = 0.5;
        }
      }

      // Add deterministic noise to every dim
      for (let i = 0; i < dim; i++) {
        v[i] += (rng() - 0.5) * 2 * noiseLevel;
      }

      const normalized = l2Normalize(v);
      const id = `t${t}-d${d}`;
      entries.push({ id, topic: t, isDuplicate: isDup, vector: normalized });
      relevantByTopic[t]!.add(id);
    }
  }

  return {
    entries,
    relevantByTopic,
    topicQueryVectors,
    options: { topics, docsPerTopic, dim, duplicateRatio, noiseLevel, seed },
  };
}
