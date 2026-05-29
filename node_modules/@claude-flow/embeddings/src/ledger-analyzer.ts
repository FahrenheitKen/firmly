/**
 * ADR-121 Phase 22 — Ledger analyzer + regression detection.
 *
 * The witness ledger from Phase 18 stores N historical benchmark
 * runs as a tamper-evident hash chain. Until now it served only as
 * provenance — "I observed these numbers at this commit." This phase
 * adds the missing layer: **using the chain to detect performance
 * regressions** on every new run.
 *
 * Pattern:
 *   1. Read the ledger.
 *   2. For each benchmark name, pull every historical entry that
 *      ran the same benchmark.
 *   3. Extract a named metric path (e.g. "results.summary.adaptive.meanRecallAt5").
 *   4. Compare the current value to the baseline (most recent prior
 *      entry, or the best, or a rolling window) and report the delta.
 *   5. Fail CI if the delta exceeds the configured threshold.
 *
 * Because the ledger is hash-chained (Phase 18), an attacker can't
 * silently rewrite a historical baseline to make a regression look
 * like an improvement — the chain verification would catch the
 * tamper before the regression check ran.
 */

import type { BenchmarkLedger, LedgerEntry } from './witness-ledger.js';

/**
 * Extract a value at a dotted path from a nested object. Returns
 * `undefined` if any segment is missing or the final value is not
 * numeric.
 */
export function getMetricAtPath(obj: unknown, path: string): number | undefined {
  if (path.length === 0) return undefined;
  const segments = path.split('.');
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : undefined;
}

export interface BaselineSelection {
  /**
   * Which baseline to compare against:
   *   - 'latest' — most recent prior entry with the same benchmark name
   *   - 'best' — the entry with the maximum (or minimum, see direction) metric value
   *   - 'first' — the earliest entry (genesis-of-this-benchmark)
   */
  readonly strategy: 'latest' | 'best' | 'first';
  /**
   * Optimization direction: 'higher' means larger metric values are
   * better (recall, nDCG). 'lower' means smaller is better (latency,
   * embeds, cost). Default 'higher'.
   */
  readonly direction?: 'higher' | 'lower';
}

export interface RegressionCheckOptions {
  /**
   * Maximum allowed regression. Interpreted as a fractional change
   * vs baseline (e.g. 0.05 = 5%). For 'higher-is-better' metrics, a
   * regression means current < baseline. For 'lower-is-better'
   * metrics, a regression means current > baseline.
   * Default 0.10 (10%).
   */
  readonly threshold?: number;
  /** Baseline selection — defaults to { strategy: 'latest', direction: 'higher' }. */
  readonly baseline?: BaselineSelection;
}

export interface RegressionCheckResult {
  readonly benchmark: string;
  readonly metricPath: string;
  readonly currentValue: number;
  /** Baseline value used for the comparison, or null if no prior runs exist. */
  readonly baselineValue: number | null;
  /** Which historical entry the baseline came from (sequence + timestamp). */
  readonly baselineFrom: { sequence: number; timestamp: string } | null;
  /** Absolute delta = current - baseline. */
  readonly delta: number;
  /**
   * Fractional change = delta / baseline. Positive when current is
   * larger than baseline (regardless of optimization direction).
   */
  readonly percentChange: number;
  /** True if the check passed (no major regression). */
  readonly passed: boolean;
  /** Human-readable reason. */
  readonly reason: string;
}

/**
 * Collect all ledger entries with a given benchmark name, in chain
 * order (oldest first). Useful for building plots, computing
 * rolling-window stats, etc.
 */
export function entriesForBenchmark(
  ledger: BenchmarkLedger,
  benchmarkName: string,
): ReadonlyArray<LedgerEntry> {
  return ledger.entries.filter(e => e.benchmark === benchmarkName);
}

/**
 * Pick the baseline value from a ledger for a (benchmark, metric)
 * pair under the supplied strategy. Returns null when the chain has
 * no entries with both a matching benchmark name AND a numeric value
 * at the metric path.
 */
export function pickBaseline(
  ledger: BenchmarkLedger,
  benchmarkName: string,
  metricPath: string,
  selection: BaselineSelection,
): { value: number; entry: LedgerEntry } | null {
  const candidates = entriesForBenchmark(ledger, benchmarkName)
    .map(e => ({ entry: e, value: getMetricAtPath(e, metricPath) }))
    .filter((x): x is { entry: LedgerEntry; value: number } => x.value !== undefined);
  if (candidates.length === 0) return null;

  const direction = selection.direction ?? 'higher';

  switch (selection.strategy) {
    case 'first':
      return { value: candidates[0]!.value, entry: candidates[0]!.entry };
    case 'latest':
      return { value: candidates[candidates.length - 1]!.value, entry: candidates[candidates.length - 1]!.entry };
    case 'best': {
      let best = candidates[0]!;
      for (const c of candidates.slice(1)) {
        const isBetter = direction === 'higher' ? c.value > best.value : c.value < best.value;
        if (isBetter) best = c;
      }
      return { value: best.value, entry: best.entry };
    }
    default:
      throw new Error(`unknown baseline strategy: ${selection.strategy}`);
  }
}

/**
 * Check whether the current value regressed against the ledger
 * baseline. Returns a structured result with the delta and reason.
 */
export function checkRegression(
  ledger: BenchmarkLedger,
  benchmarkName: string,
  metricPath: string,
  currentValue: number,
  options: RegressionCheckOptions = {},
): RegressionCheckResult {
  const threshold = options.threshold ?? 0.10;
  const baselineSel: BaselineSelection = options.baseline ?? { strategy: 'latest', direction: 'higher' };

  const baseline = pickBaseline(ledger, benchmarkName, metricPath, baselineSel);

  if (baseline === null) {
    return {
      benchmark: benchmarkName,
      metricPath,
      currentValue,
      baselineValue: null,
      baselineFrom: null,
      delta: 0,
      percentChange: 0,
      passed: true,
      reason: `no prior entries for benchmark='${benchmarkName}' with numeric '${metricPath}' — first run, nothing to regress against`,
    };
  }

  const direction = baselineSel.direction ?? 'higher';
  const delta = currentValue - baseline.value;
  // Guard divide-by-zero (rare in practice — recall=0 baselines).
  const percentChange = baseline.value === 0
    ? (currentValue === 0 ? 0 : Infinity)
    : delta / Math.abs(baseline.value);

  // For higher-is-better: regression = percentChange < -threshold
  // For lower-is-better:  regression = percentChange > +threshold
  let passed: boolean;
  let reason: string;
  if (direction === 'higher') {
    if (percentChange >= -threshold) {
      passed = true;
      const sign = percentChange >= 0 ? '+' : '';
      reason = `current ${currentValue.toFixed(4)} ${sign}${(percentChange * 100).toFixed(1)}% vs baseline ${baseline.value.toFixed(4)} (within ${(threshold * 100).toFixed(0)}% tolerance for higher-is-better)`;
    } else {
      passed = false;
      reason = `REGRESSION: current ${currentValue.toFixed(4)} dropped ${Math.abs(percentChange * 100).toFixed(1)}% vs baseline ${baseline.value.toFixed(4)} (exceeds ${(threshold * 100).toFixed(0)}% threshold)`;
    }
  } else {
    if (percentChange <= threshold) {
      passed = true;
      const sign = percentChange >= 0 ? '+' : '';
      reason = `current ${currentValue.toFixed(4)} ${sign}${(percentChange * 100).toFixed(1)}% vs baseline ${baseline.value.toFixed(4)} (within ${(threshold * 100).toFixed(0)}% tolerance for lower-is-better)`;
    } else {
      passed = false;
      reason = `REGRESSION: current ${currentValue.toFixed(4)} grew ${(percentChange * 100).toFixed(1)}% vs baseline ${baseline.value.toFixed(4)} (exceeds ${(threshold * 100).toFixed(0)}% threshold)`;
    }
  }

  return {
    benchmark: benchmarkName,
    metricPath,
    currentValue,
    baselineValue: baseline.value,
    baselineFrom: { sequence: baseline.entry.sequence, timestamp: baseline.entry.timestamp },
    delta,
    percentChange,
    passed,
    reason,
  };
}

/**
 * Run multiple regression checks at once. Returns the per-check
 * results plus an aggregate `allPassed` flag.
 */
export interface RegressionBatchInput {
  readonly benchmark: string;
  readonly metricPath: string;
  readonly currentValue: number;
  readonly options?: RegressionCheckOptions;
}

export interface RegressionBatchResult {
  readonly allPassed: boolean;
  readonly checks: ReadonlyArray<RegressionCheckResult>;
}

export function checkRegressionBatch(
  ledger: BenchmarkLedger,
  inputs: ReadonlyArray<RegressionBatchInput>,
): RegressionBatchResult {
  const checks = inputs.map(i =>
    checkRegression(ledger, i.benchmark, i.metricPath, i.currentValue, i.options),
  );
  return {
    allPassed: checks.every(c => c.passed),
    checks,
  };
}
