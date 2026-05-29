/**
 * ADR-121 Phase 22 — Ledger analyzer + regression detection tests.
 */

import { describe, it, expect } from 'vitest';
import {
  getMetricAtPath,
  entriesForBenchmark,
  pickBaseline,
  checkRegression,
  checkRegressionBatch,
} from '../ledger-analyzer.js';
import { appendToLedger, generateLedgerKeypair, type BenchmarkLedger } from '../witness-ledger.js';

function input(name: string, ts: string, results: unknown, opts: { commit?: string } = {}) {
  return {
    benchmark: name,
    timestamp: ts,
    commit: opts.commit ?? 'commit-xyz',
    model: 'test-model',
    corpus: { id: 'fp-corpus', size: 10 },
    queries: { id: 'fp-queries', count: 3 },
    results,
  };
}

function buildLedger(specs: Array<[name: string, ts: string, results: unknown]>): BenchmarkLedger {
  const kp = generateLedgerKeypair();
  let ledger: BenchmarkLedger | undefined;
  for (const [name, ts, results] of specs) {
    ledger = appendToLedger(ledger, input(name, ts, results), kp).ledger;
  }
  return ledger!;
}

// =========================================================
describe('getMetricAtPath', () => {
  it('returns the numeric value at a dotted path', () => {
    expect(getMetricAtPath({ a: { b: { c: 0.85 } } }, 'a.b.c')).toBe(0.85);
  });

  it('returns undefined for missing segments', () => {
    expect(getMetricAtPath({ a: { b: 1 } }, 'a.c.d')).toBeUndefined();
    expect(getMetricAtPath({ a: 1 }, 'a.b')).toBeUndefined();
  });

  it('returns undefined for non-numeric leaves', () => {
    expect(getMetricAtPath({ a: 'string' }, 'a')).toBeUndefined();
    expect(getMetricAtPath({ a: true }, 'a')).toBeUndefined();
    expect(getMetricAtPath({ a: NaN }, 'a')).toBeUndefined();
  });

  it('returns undefined for empty path', () => {
    expect(getMetricAtPath({ a: 1 }, '')).toBeUndefined();
  });

  it('returns undefined for null/undefined intermediate', () => {
    expect(getMetricAtPath({ a: null }, 'a.b')).toBeUndefined();
    expect(getMetricAtPath(null, 'a')).toBeUndefined();
  });
});

// =========================================================
describe('entriesForBenchmark', () => {
  it('filters by benchmark name in chain order', () => {
    const ledger = buildLedger([
      ['bench-a', '2026-01-01T00:00:00Z', { x: 1 }],
      ['bench-b', '2026-01-02T00:00:00Z', { x: 2 }],
      ['bench-a', '2026-01-03T00:00:00Z', { x: 3 }],
    ]);
    const aEntries = entriesForBenchmark(ledger, 'bench-a');
    expect(aEntries.length).toBe(2);
    expect(aEntries[0]!.sequence).toBe(1);
    expect(aEntries[1]!.sequence).toBe(3);
  });

  it('returns [] for unknown benchmark name', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { x: 1 }]]);
    expect(entriesForBenchmark(ledger, 'unknown').length).toBe(0);
  });
});

// =========================================================
describe('pickBaseline', () => {
  it('returns null when no entries for benchmark exist', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { x: 1 }]]);
    expect(pickBaseline(ledger, 'unknown', 'x', { strategy: 'latest' })).toBeNull();
  });

  it("returns null when metric path doesn't exist in any entry", () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { x: 1 }]]);
    expect(pickBaseline(ledger, 'bench-a', 'missing.path', { strategy: 'latest' })).toBeNull();
  });

  it('strategy=first picks the earliest matching entry', () => {
    const ledger = buildLedger([
      ['bench-a', '2026-01-01T00:00:00Z', { x: 0.5 }],
      ['bench-a', '2026-01-02T00:00:00Z', { x: 0.8 }],
      ['bench-a', '2026-01-03T00:00:00Z', { x: 0.7 }],
    ]);
    const b = pickBaseline(ledger, 'bench-a', 'results.x', { strategy: 'first' });
    expect(b?.value).toBe(0.5);
  });

  it('strategy=latest picks the most recent matching entry', () => {
    const ledger = buildLedger([
      ['bench-a', '2026-01-01T00:00:00Z', { x: 0.5 }],
      ['bench-a', '2026-01-02T00:00:00Z', { x: 0.8 }],
      ['bench-a', '2026-01-03T00:00:00Z', { x: 0.7 }],
    ]);
    const b = pickBaseline(ledger, 'bench-a', 'results.x', { strategy: 'latest' });
    expect(b?.value).toBe(0.7);
  });

  it('strategy=best with direction=higher picks the max', () => {
    const ledger = buildLedger([
      ['bench-a', '2026-01-01T00:00:00Z', { x: 0.5 }],
      ['bench-a', '2026-01-02T00:00:00Z', { x: 0.9 }],
      ['bench-a', '2026-01-03T00:00:00Z', { x: 0.7 }],
    ]);
    const b = pickBaseline(ledger, 'bench-a', 'results.x', { strategy: 'best', direction: 'higher' });
    expect(b?.value).toBe(0.9);
  });

  it('strategy=best with direction=lower picks the min', () => {
    const ledger = buildLedger([
      ['bench-a', '2026-01-01T00:00:00Z', { latency: 100 }],
      ['bench-a', '2026-01-02T00:00:00Z', { latency: 50 }],
      ['bench-a', '2026-01-03T00:00:00Z', { latency: 75 }],
    ]);
    const b = pickBaseline(ledger, 'bench-a', 'results.latency', { strategy: 'best', direction: 'lower' });
    expect(b?.value).toBe(50);
  });
});

// =========================================================
describe('checkRegression — first run / no baseline', () => {
  it('passes with explanatory reason when no prior entries exist', () => {
    // buildLedger([]) returns undefined; use the empty-ledger shape
    // a real first run would pass: { version: 1, entries: [] }.
    const ledger = { version: 1 as const, entries: [] };
    const r = checkRegression(ledger, 'bench-a', 'results.x', 0.5);
    expect(r.passed).toBe(true);
    expect(r.baselineValue).toBeNull();
    expect(r.baselineFrom).toBeNull();
    expect(r.reason).toMatch(/no prior entries/);
  });
});

// =========================================================
describe('checkRegression — higher-is-better', () => {
  it('PASS when current matches baseline exactly', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { recall: 0.85 }]]);
    const r = checkRegression(ledger, 'bench-a', 'results.recall', 0.85);
    expect(r.passed).toBe(true);
    expect(r.delta).toBe(0);
  });

  it('PASS on improvement (current > baseline)', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { recall: 0.85 }]]);
    const r = checkRegression(ledger, 'bench-a', 'results.recall', 0.95);
    expect(r.passed).toBe(true);
    expect(r.percentChange).toBeCloseTo(0.1176, 3);
  });

  it('PASS on small regression within threshold (5% drop, 10% threshold)', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { recall: 1.0 }]]);
    const r = checkRegression(ledger, 'bench-a', 'results.recall', 0.95);
    expect(r.passed).toBe(true);
    expect(r.percentChange).toBeCloseTo(-0.05, 3);
  });

  it('FAIL on regression beyond threshold (15% drop, 10% threshold)', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { recall: 1.0 }]]);
    const r = checkRegression(ledger, 'bench-a', 'results.recall', 0.85);
    expect(r.passed).toBe(false);
    expect(r.reason).toMatch(/REGRESSION/);
  });

  it('custom threshold changes the verdict', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { recall: 1.0 }]]);
    const tight = checkRegression(ledger, 'bench-a', 'results.recall', 0.95, { threshold: 0.02 });
    expect(tight.passed).toBe(false);
    const loose = checkRegression(ledger, 'bench-a', 'results.recall', 0.95, { threshold: 0.10 });
    expect(loose.passed).toBe(true);
  });

  it('baselineFrom reports the entry the baseline came from', () => {
    const ledger = buildLedger([
      ['bench-a', '2026-01-01T00:00:00Z', { x: 1 }],
      ['bench-a', '2026-01-02T00:00:00Z', { x: 2 }],
    ]);
    const r = checkRegression(ledger, 'bench-a', 'results.x', 2);
    expect(r.baselineFrom).toEqual({ sequence: 2, timestamp: '2026-01-02T00:00:00Z' });
  });
});

// =========================================================
describe('checkRegression — lower-is-better (latency, cost)', () => {
  it('PASS when current matches baseline', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { latency: 100 }]]);
    const r = checkRegression(ledger, 'bench-a', 'results.latency', 100, { baseline: { strategy: 'latest', direction: 'lower' } });
    expect(r.passed).toBe(true);
  });

  it('PASS on improvement (current < baseline)', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { latency: 100 }]]);
    const r = checkRegression(ledger, 'bench-a', 'results.latency', 50, { baseline: { strategy: 'latest', direction: 'lower' } });
    expect(r.passed).toBe(true);
  });

  it('PASS on small growth within threshold (5% growth, 10% threshold)', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { latency: 100 }]]);
    const r = checkRegression(ledger, 'bench-a', 'results.latency', 105, { baseline: { strategy: 'latest', direction: 'lower' } });
    expect(r.passed).toBe(true);
  });

  it('FAIL on growth beyond threshold (50% growth, 10% threshold)', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { latency: 100 }]]);
    const r = checkRegression(ledger, 'bench-a', 'results.latency', 150, { baseline: { strategy: 'latest', direction: 'lower' } });
    expect(r.passed).toBe(false);
    expect(r.reason).toMatch(/REGRESSION.*grew/);
  });
});

// =========================================================
describe('checkRegression — edge cases', () => {
  it('handles baseline = 0 without divide-by-zero', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { x: 0 }]]);
    const same = checkRegression(ledger, 'bench-a', 'results.x', 0);
    expect(same.percentChange).toBe(0);
    expect(same.passed).toBe(true);

    const grown = checkRegression(ledger, 'bench-a', 'results.x', 5);
    expect(grown.percentChange).toBe(Infinity);
    // Infinity > -threshold for higher-is-better → passes (huge improvement).
    expect(grown.passed).toBe(true);
  });

  it('reads from `results.*` path (witness manifest shape)', () => {
    const ledger = buildLedger([
      ['rag-real-text', '2026-01-01T00:00:00Z', { summary: { adaptive: { meanRecallAt5: 0.85 } } }],
    ]);
    const r = checkRegression(ledger, 'rag-real-text', 'results.summary.adaptive.meanRecallAt5', 0.90);
    expect(r.passed).toBe(true);
    expect(r.baselineValue).toBe(0.85);
  });
});

// =========================================================
describe('checkRegressionBatch', () => {
  it('all checks pass → allPassed=true', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { x: 0.85, y: 0.92 }]]);
    const r = checkRegressionBatch(ledger, [
      { benchmark: 'bench-a', metricPath: 'results.x', currentValue: 0.85 },
      { benchmark: 'bench-a', metricPath: 'results.y', currentValue: 0.95 },
    ]);
    expect(r.allPassed).toBe(true);
    expect(r.checks.length).toBe(2);
  });

  it('any check fails → allPassed=false', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { x: 1.0, y: 1.0 }]]);
    const r = checkRegressionBatch(ledger, [
      { benchmark: 'bench-a', metricPath: 'results.x', currentValue: 1.0 },
      { benchmark: 'bench-a', metricPath: 'results.y', currentValue: 0.5 }, // 50% drop
    ]);
    expect(r.allPassed).toBe(false);
    expect(r.checks[0]!.passed).toBe(true);
    expect(r.checks[1]!.passed).toBe(false);
  });

  it('mixed higher/lower directions in one batch', () => {
    const ledger = buildLedger([['bench-a', '2026-01-01T00:00:00Z', { recall: 0.9, latency: 100 }]]);
    const r = checkRegressionBatch(ledger, [
      { benchmark: 'bench-a', metricPath: 'results.recall', currentValue: 0.92 },
      { benchmark: 'bench-a', metricPath: 'results.latency', currentValue: 90, options: { baseline: { strategy: 'latest', direction: 'lower' } } },
    ]);
    expect(r.allPassed).toBe(true);
  });
});
