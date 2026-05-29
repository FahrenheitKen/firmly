/**
 * ADR-121 Phase 20 — Lazy adaptive router tests.
 *
 * Covers:
 *  - Short-circuit cases: MMR signal fires → variant+hyp embeds skipped
 *  - Falls through to plain when no signal fires (all embeds used)
 *  - Cost accounting: embedsUsed / embedsEager / embedsSaved consistent
 *  - Cached vectors are populated correctly per branch
 *  - Custom thresholds propagate to the decision
 *  - End-to-end: lazy with same input as eager produces equivalent
 *    primitive choice (when both have the same features available)
 */

import { describe, it, expect, vi } from 'vitest';
import { lazyAdaptiveRoute, type LazyEmbedAdapter, type LazyCandidateSource } from '../lazy-adaptive-router.js';

const DIM = 8;
function unit(values: number[]): Float32Array {
  const v = new Float32Array(DIM);
  values.forEach((x, i) => { v[i] = x; });
  let sq = 0;
  for (const x of v) sq += x * x;
  if (sq === 0) return v;
  const n = Math.sqrt(sq);
  const out = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) out[i] = v[i]! / n;
  return out;
}

// Build mock embed + candidates adapters that return deterministic
// vectors based on the text content. Lets tests construct precise
// topology shapes per scenario.
function makeAdapters(textToVec: Record<string, Float32Array>, corpusForTopK: Array<{ id: string; vector: Float32Array }>) {
  const embed = vi.fn(async (text: string): Promise<Float32Array> => {
    const v = textToVec[text];
    if (!v) throw new Error(`unmapped text: ${text}`);
    return v;
  });
  const topK = vi.fn(async (q: Float32Array | number[], k: number) => {
    // Plain cosine top-k against corpus.
    const scored = corpusForTopK.map(c => {
      let dot = 0;
      for (let i = 0; i < DIM; i++) dot += (q as Float32Array)[i]! * c.vector[i]!;
      return { id: c.id, vector: c.vector, score: dot };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  });
  return { embed: { embed } as LazyEmbedAdapter, topK: { topK } as LazyCandidateSource, embedSpy: embed, topKSpy: topK };
}

describe('lazyAdaptiveRoute — short-circuit', () => {
  it('MMR signal fires → variant + hypothetical embeds SKIPPED', async () => {
    // 5 near-duplicate candidates → duplicateDensity ≈ 1.0
    const corpus = [
      { id: 'a1', vector: unit([1, 0, 0, 0, 0, 0, 0, 0]) },
      { id: 'a2', vector: unit([0.99, 0.01, 0, 0, 0, 0, 0, 0]) },
      { id: 'a3', vector: unit([0.98, 0.02, 0, 0, 0, 0, 0, 0]) },
      { id: 'a4', vector: unit([0.97, 0.03, 0, 0, 0, 0, 0, 0]) },
      { id: 'a5', vector: unit([0.96, 0.04, 0, 0, 0, 0, 0, 0]) },
    ];
    const adapters = makeAdapters({
      'q': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'v1': unit([0.5, 0.5, 0, 0, 0, 0, 0, 0]),
      'v2': unit([0, 1, 0, 0, 0, 0, 0, 0]),
      'h1': unit([0, 0.7, 0.7, 0, 0, 0, 0, 0]),
    }, corpus);

    const result = await lazyAdaptiveRoute(
      adapters.embed,
      adapters.topK,
      { queryText: 'q', variantTexts: ['v1', 'v2'], hypotheticalTexts: ['h1'] },
    );

    expect(result.decision.primitive).toBe('mmr');
    // Embeds: just the question (1). Variants + hypotheticals skipped.
    expect(result.cost.embedsUsed).toBe(1);
    expect(result.cost.embedsEager).toBe(4); // 1 + 2 + 1
    expect(result.cost.embedsSaved).toBe(3);
    expect(result.cost.skippedSteps).toEqual(['variants', 'hypotheticals']);
    // Embed function called exactly once (for the question).
    expect(adapters.embedSpy).toHaveBeenCalledTimes(1);
  });

  it('No early signal → embeds variants → fires RRF', async () => {
    // Diverse top-k → no MMR signal. Orthogonal variants → low cohesion → RRF fires.
    const corpus = [
      { id: 'a', vector: unit([1, 0, 0, 0, 0, 0, 0, 0]) },
      { id: 'b', vector: unit([0, 1, 0, 0, 0, 0, 0, 0]) },
      { id: 'c', vector: unit([0, 0, 1, 0, 0, 0, 0, 0]) },
    ];
    const adapters = makeAdapters({
      'q': unit([0.5, 0.5, 0, 0, 0, 0, 0, 0]),
      'v1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'v2': unit([0, 1, 0, 0, 0, 0, 0, 0]),
      'v3': unit([0, 0, 1, 0, 0, 0, 0, 0]),
      'h1': unit([0.5, 0.5, 0, 0, 0, 0, 0, 0]),
    }, corpus);

    const result = await lazyAdaptiveRoute(
      adapters.embed,
      adapters.topK,
      { queryText: 'q', variantTexts: ['v1', 'v2', 'v3'], hypotheticalTexts: ['h1'] },
    );

    expect(result.decision.primitive).toBe('rrf');
    // Embeds: 1 (question) + 3 (variants). Hypothetical skipped.
    expect(result.cost.embedsUsed).toBe(4);
    expect(result.cost.embedsEager).toBe(5);
    expect(result.cost.embedsSaved).toBe(1);
    expect(result.cost.skippedSteps).toEqual(['hypotheticals']);
  });

  it('No early signal AND no variant signal → embeds hypotheticals → fires HyDE', async () => {
    // Diverse top-k → no MMR. Cohesive variants → no RRF.
    // Question orthogonal to hypotheticals → high qaGap → HyDE.
    const corpus = [
      { id: 'a', vector: unit([1, 0, 0, 0, 0, 0, 0, 0]) },
      { id: 'b', vector: unit([0, 1, 0, 0, 0, 0, 0, 0]) },
    ];
    const adapters = makeAdapters({
      'q': unit([0, 0, 0, 0, 0, 0, 0, 1]),
      'v1': unit([0, 0, 0, 0, 0, 0, 0, 1]),
      'v2': unit([0, 0, 0, 0, 0, 0, 0.1, 1]),
      'h1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'h2': unit([0.9, 0.1, 0, 0, 0, 0, 0, 0]),
    }, corpus);

    const result = await lazyAdaptiveRoute(
      adapters.embed,
      adapters.topK,
      { queryText: 'q', variantTexts: ['v1', 'v2'], hypotheticalTexts: ['h1', 'h2'] },
    );

    expect(result.decision.primitive).toBe('hyde');
    // Embeds: 1 (question) + 2 (variants — no signal) + 2 (hyps — fires HyDE)
    expect(result.cost.embedsUsed).toBe(5);
    expect(result.cost.embedsSaved).toBe(0);
    expect(result.cost.skippedSteps).toEqual([]);
  });

  it('No signal anywhere → falls through to plain (full extraction)', async () => {
    // Diverse top-k, cohesive variants, hypotheticals aligned with question.
    const corpus = [
      { id: 'a', vector: unit([1, 0, 0, 0, 0, 0, 0, 0]) },
      { id: 'b', vector: unit([0, 1, 0, 0, 0, 0, 0, 0]) },
    ];
    const adapters = makeAdapters({
      'q': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'v1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'v2': unit([0.95, 0.05, 0, 0, 0, 0, 0, 0]),
      'h1': unit([0.95, 0.05, 0, 0, 0, 0, 0, 0]),
    }, corpus);

    const result = await lazyAdaptiveRoute(
      adapters.embed,
      adapters.topK,
      { queryText: 'q', variantTexts: ['v1', 'v2'], hypotheticalTexts: ['h1'] },
    );

    expect(result.decision.primitive).toBe('plain');
    expect(result.cost.embedsUsed).toBe(4); // 1 + 2 + 1
    expect(result.cost.embedsSaved).toBe(0);
  });
});

describe('lazyAdaptiveRoute — cost accounting', () => {
  it('embedsUsed + embedsSaved === embedsEager', async () => {
    const corpus = [{ id: 'a', vector: unit([1, 0, 0, 0, 0, 0, 0, 0]) }];
    const adapters = makeAdapters({
      'q': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'v1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'h1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
    }, corpus);
    const r = await lazyAdaptiveRoute(
      adapters.embed,
      adapters.topK,
      { queryText: 'q', variantTexts: ['v1'], hypotheticalTexts: ['h1'] },
    );
    expect(r.cost.embedsUsed + r.cost.embedsSaved).toBe(r.cost.embedsEager);
  });

  it('zero variants and hypotheticals → just the question', async () => {
    const corpus = [{ id: 'a', vector: unit([1, 0, 0, 0, 0, 0, 0, 0]) }];
    const adapters = makeAdapters({ 'q': unit([1, 0, 0, 0, 0, 0, 0, 0]) }, corpus);
    const r = await lazyAdaptiveRoute(
      adapters.embed,
      adapters.topK,
      { queryText: 'q', variantTexts: [], hypotheticalTexts: [] },
    );
    expect(r.cost.embedsUsed).toBe(1);
    expect(r.cost.embedsEager).toBe(1);
    expect(r.cost.embedsSaved).toBe(0);
  });
});

describe('lazyAdaptiveRoute — cached vectors', () => {
  it('returns the question vector and top candidates always', async () => {
    const corpus = [{ id: 'a', vector: unit([1, 0, 0, 0, 0, 0, 0, 0]) }];
    const adapters = makeAdapters({
      'q': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'v1': unit([0, 1, 0, 0, 0, 0, 0, 0]),
      'h1': unit([0, 0, 1, 0, 0, 0, 0, 0]),
    }, corpus);
    const r = await lazyAdaptiveRoute(
      adapters.embed,
      adapters.topK,
      { queryText: 'q', variantTexts: ['v1'], hypotheticalTexts: ['h1'] },
    );
    expect(r.cached.queryVector).toBeDefined();
    expect(r.cached.topCandidates.length).toBeGreaterThan(0);
  });

  it('short-circuit on MMR leaves variant/hypothetical vectors empty', async () => {
    const corpus = [
      { id: 'a1', vector: unit([1, 0, 0, 0, 0, 0, 0, 0]) },
      { id: 'a2', vector: unit([0.99, 0.01, 0, 0, 0, 0, 0, 0]) },
      { id: 'a3', vector: unit([0.98, 0.02, 0, 0, 0, 0, 0, 0]) },
      { id: 'a4', vector: unit([0.97, 0.03, 0, 0, 0, 0, 0, 0]) },
    ];
    const adapters = makeAdapters({
      'q': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'v1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'h1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
    }, corpus);
    const r = await lazyAdaptiveRoute(
      adapters.embed,
      adapters.topK,
      { queryText: 'q', variantTexts: ['v1'], hypotheticalTexts: ['h1'] },
    );
    expect(r.decision.primitive).toBe('mmr');
    expect(r.cached.variantVectors.length).toBe(0);
    expect(r.cached.hypotheticalVectors.length).toBe(0);
  });
});

describe('lazyAdaptiveRoute — option pass-through', () => {
  it('custom duplicateThreshold changes the decision', async () => {
    // Mostly-spread candidates: cos(a1,a2)≈0.7, cos(a1,a3)≈0 →
    // mean pairwise ≈ 0.5, which is well below default 0.85 and
    // below 0.99 — no MMR signal at either threshold.
    const corpusSpread = [
      { id: 'a1', vector: unit([1, 0, 0, 0, 0, 0, 0, 0]) },
      { id: 'a2', vector: unit([0.7, 0.7, 0, 0, 0, 0, 0, 0]) },
      { id: 'a3', vector: unit([0, 0, 1, 0, 0, 0, 0, 0]) },
    ];
    // Moderately-dup candidates: mean pairwise ≈ 0.9 → fires MMR
    // at default 0.85, does NOT fire at custom 0.95.
    const corpusDups = [
      { id: 'd1', vector: unit([1, 0.3, 0, 0, 0, 0, 0, 0]) },
      { id: 'd2', vector: unit([1, 0, 0.3, 0, 0, 0, 0, 0]) },
      { id: 'd3', vector: unit([1, 0, 0, 0.3, 0, 0, 0, 0]) },
    ];

    // Dup corpus at default → MMR fires.
    const a1 = makeAdapters({
      'q': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'v1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'h1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
    }, corpusDups);
    const r1 = await lazyAdaptiveRoute(
      a1.embed, a1.topK,
      { queryText: 'q', variantTexts: ['v1'], hypotheticalTexts: ['h1'] },
    );
    expect(r1.decision.primitive).toBe('mmr');

    // Same dup corpus at threshold 0.99 → MMR doesn't fire; falls
    // through to plain (no variant orthogonality + no qa gap).
    const a2 = makeAdapters({
      'q': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'v1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'h1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
    }, corpusDups);
    const r2 = await lazyAdaptiveRoute(
      a2.embed, a2.topK,
      { queryText: 'q', variantTexts: ['v1'], hypotheticalTexts: ['h1'] },
      { duplicateThreshold: 0.95 }, // higher than the actual ~0.9 density
    );
    expect(r2.decision.primitive).toBe('plain');
    // Sanity: corpusSpread doesn't accidentally trip dup signal.
    const a3 = makeAdapters({
      'q': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'v1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
      'h1': unit([1, 0, 0, 0, 0, 0, 0, 0]),
    }, corpusSpread);
    const r3 = await lazyAdaptiveRoute(
      a3.embed, a3.topK,
      { queryText: 'q', variantTexts: ['v1'], hypotheticalTexts: ['h1'] },
    );
    expect(r3.decision.primitive).toBe('plain');
  });
});
