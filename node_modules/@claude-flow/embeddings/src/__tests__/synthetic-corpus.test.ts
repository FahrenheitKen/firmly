/**
 * ADR-121 Phase 15 — buildSyntheticTopicCorpus tests.
 */

import { describe, it, expect } from 'vitest';
import { buildSyntheticTopicCorpus } from '../synthetic-corpus.js';

describe('buildSyntheticTopicCorpus — basic shape', () => {
  it('throws on bad inputs', () => {
    expect(() => buildSyntheticTopicCorpus({ topics: 0, docsPerTopic: 5, dim: 16 })).toThrow();
    expect(() => buildSyntheticTopicCorpus({ topics: 3, docsPerTopic: 0, dim: 16 })).toThrow();
    expect(() => buildSyntheticTopicCorpus({ topics: 5, docsPerTopic: 5, dim: 3 })).toThrow();
  });

  it('produces topics × docsPerTopic entries', () => {
    const c = buildSyntheticTopicCorpus({ topics: 3, docsPerTopic: 5, dim: 16 });
    expect(c.entries.length).toBe(15);
  });

  it('every entry has a unique id', () => {
    const c = buildSyntheticTopicCorpus({ topics: 4, docsPerTopic: 10, dim: 16 });
    const ids = new Set(c.entries.map(e => e.id));
    expect(ids.size).toBe(c.entries.length);
  });

  it('every vector is L2-unit-normalized', () => {
    const c = buildSyntheticTopicCorpus({ topics: 3, docsPerTopic: 4, dim: 16 });
    for (const e of c.entries) {
      let sq = 0;
      for (let i = 0; i < e.vector.length; i++) sq += e.vector[i]! * e.vector[i]!;
      expect(Math.sqrt(sq)).toBeCloseTo(1, 5);
    }
  });

  it('every vector has the requested dim', () => {
    const c = buildSyntheticTopicCorpus({ topics: 3, docsPerTopic: 5, dim: 32 });
    for (const e of c.entries) {
      expect(e.vector.length).toBe(32);
    }
  });
});

describe('buildSyntheticTopicCorpus — topic structure', () => {
  it('topicQueryVectors has one per topic', () => {
    const c = buildSyntheticTopicCorpus({ topics: 4, docsPerTopic: 3, dim: 16 });
    expect(c.topicQueryVectors.length).toBe(4);
  });

  it('topic query vectors are unit-norm one-hot on the topic axis', () => {
    const c = buildSyntheticTopicCorpus({ topics: 3, docsPerTopic: 1, dim: 8 });
    for (let t = 0; t < c.topicQueryVectors.length; t++) {
      const q = c.topicQueryVectors[t]!;
      // The topic axis should have value 1 (post-normalization of a one-hot is itself).
      expect(q[t]).toBeCloseTo(1, 6);
      for (let i = 0; i < q.length; i++) {
        if (i !== t) expect(q[i]).toBeCloseTo(0, 6);
      }
    }
  });

  it('relevantByTopic[t] contains every doc with topic=t', () => {
    const c = buildSyntheticTopicCorpus({ topics: 3, docsPerTopic: 4, dim: 16 });
    for (let t = 0; t < 3; t++) {
      const rel = c.relevantByTopic[t]!;
      const fromEntries = c.entries.filter(e => e.topic === t).map(e => e.id);
      expect(rel.size).toBe(fromEntries.length);
      for (const id of fromEntries) expect(rel.has(id)).toBe(true);
    }
  });

  it('duplicateRatio=1 → all docs marked isDuplicate', () => {
    const c = buildSyntheticTopicCorpus({ topics: 2, docsPerTopic: 5, dim: 8, duplicateRatio: 1 });
    expect(c.entries.every(e => e.isDuplicate)).toBe(true);
  });

  it('duplicateRatio=0 → no docs marked isDuplicate', () => {
    const c = buildSyntheticTopicCorpus({ topics: 2, docsPerTopic: 5, dim: 8, duplicateRatio: 0 });
    expect(c.entries.every(e => !e.isDuplicate)).toBe(true);
  });

  it('duplicateRatio=0.4 (default) → ~40% are duplicates', () => {
    const c = buildSyntheticTopicCorpus({ topics: 5, docsPerTopic: 10, dim: 16 });
    const dups = c.entries.filter(e => e.isDuplicate).length;
    expect(dups / c.entries.length).toBeCloseTo(0.4, 1);
  });
});

describe('buildSyntheticTopicCorpus — determinism', () => {
  it('same options → bit-for-bit identical corpus', () => {
    const a = buildSyntheticTopicCorpus({ topics: 3, docsPerTopic: 5, dim: 16, seed: 42 });
    const b = buildSyntheticTopicCorpus({ topics: 3, docsPerTopic: 5, dim: 16, seed: 42 });
    expect(a.entries.length).toBe(b.entries.length);
    for (let i = 0; i < a.entries.length; i++) {
      expect(a.entries[i]!.id).toBe(b.entries[i]!.id);
      expect(a.entries[i]!.topic).toBe(b.entries[i]!.topic);
      for (let j = 0; j < a.entries[i]!.vector.length; j++) {
        expect(a.entries[i]!.vector[j]).toBeCloseTo(b.entries[i]!.vector[j]!, 6);
      }
    }
  });

  it('different seed → different corpus', () => {
    const a = buildSyntheticTopicCorpus({ topics: 2, docsPerTopic: 3, dim: 8, seed: 1 });
    const b = buildSyntheticTopicCorpus({ topics: 2, docsPerTopic: 3, dim: 8, seed: 2 });
    // Vector content should differ even if topic IDs match.
    let anyDiff = false;
    for (let i = 0; i < a.entries.length; i++) {
      for (let j = 0; j < a.entries[i]!.vector.length; j++) {
        if (Math.abs(a.entries[i]!.vector[j]! - b.entries[i]!.vector[j]!) > 1e-6) {
          anyDiff = true;
          break;
        }
      }
      if (anyDiff) break;
    }
    expect(anyDiff).toBe(true);
  });
});

describe('buildSyntheticTopicCorpus — retrievability', () => {
  it('the highest cosine sim to topic[t]\'s query vector is a doc with topic=t', () => {
    // Verify the synthetic topology is actually retrievable — the
    // nearest-neighbor to topic t's query should belong to topic t.
    const c = buildSyntheticTopicCorpus({ topics: 4, docsPerTopic: 10, dim: 32, noiseLevel: 0.02 });
    function cos(a: Float32Array, b: Float32Array): number {
      let dot = 0;
      for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
      return dot;
    }
    for (let t = 0; t < c.topicQueryVectors.length; t++) {
      const q = c.topicQueryVectors[t]!;
      let bestId = '';
      let bestScore = -Infinity;
      for (const e of c.entries) {
        const s = cos(q, e.vector);
        if (s > bestScore) {
          bestScore = s;
          bestId = e.id;
        }
      }
      const bestEntry = c.entries.find(e => e.id === bestId)!;
      expect(bestEntry.topic).toBe(t);
    }
  });
});
