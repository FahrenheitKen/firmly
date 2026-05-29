/**
 * ADR-121 Phase 23 — Trend visualization + drift detection (BEYOND SOTA).
 *
 * Phase 22's regression check catches single-step drops well — if a
 * commit drops recall@5 by 15%, CI fails. But it misses the **death
 * by a thousand cuts** failure mode: every commit drops 1%, every
 * check passes the 10% threshold, but cumulative drift after 30
 * commits is 30%.
 *
 * This module ships two pieces:
 *   1. `renderSparkline(values)` — zero-dep ASCII sparkline using
 *      the standard 8-level block-element ramp. Turns a sequence of
 *      metric values into a one-line trend visualization for CI
 *      output, PR comments, and human dashboards.
 *   2. `detectDrift(values, options)` — rolling-window drift check.
 *      Compares the mean of the EARLIEST window to the mean of the
 *      LATEST window; reports the relative change. Designed to fire
 *      when cumulative drift exceeds the threshold even if every
 *      single-step delta was below the per-step threshold.
 *
 * Composable with Phase 22's `checkRegression`: production CI typically
 * wants BOTH — single-step regression detection (catches obvious
 * breaks) AND drift detection (catches slow rot).
 */

/**
 * Render a sequence of numeric values as an ASCII sparkline using
 * the 8-level block-element ramp:  ▁▂▃▄▅▆▇█
 *
 * - Maps min(values) → ▁ and max(values) → █, linearly interpolated.
 * - When all values are identical, renders a flat line of the
 *   middle character (▄) — visually distinguishable from "no data".
 * - Returns the empty string for an empty input.
 */
export function renderSparkline(values: ReadonlyArray<number>): string {
  if (!Array.isArray(values) || values.length === 0) return '';
  const ramp = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const filtered = values.filter(v => Number.isFinite(v));
  if (filtered.length === 0) return '?'.repeat(values.length);
  let min = Infinity;
  let max = -Infinity;
  for (const v of filtered) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return ramp[3]!.repeat(values.length);
  const span = max - min;
  return values
    .map(v => {
      if (!Number.isFinite(v)) return '?';
      const norm = (v - min) / span;
      const idx = Math.min(ramp.length - 1, Math.max(0, Math.floor(norm * ramp.length)));
      return ramp[idx]!;
    })
    .join('');
}

export interface DriftDetectionOptions {
  /**
   * How many values to average at each end of the series. Default 3.
   * The first `windowSize` values form the "early" mean; the last
   * `windowSize` values form the "late" mean.
   */
  readonly windowSize?: number;
  /**
   * Maximum allowed cumulative drift, expressed as a fractional
   * change (early → late mean). Default 0.15 (15%).
   */
  readonly threshold?: number;
  /**
   * Optimization direction. 'higher' means larger is better — drift
   * fires when late < early. 'lower' means smaller is better — drift
   * fires when late > early. Default 'higher'.
   */
  readonly direction?: 'higher' | 'lower';
}

export interface DriftDetectionResult {
  /** Number of values analyzed. */
  readonly sampleCount: number;
  /** Mean of the first windowSize values. */
  readonly earlyMean: number;
  /** Mean of the last windowSize values. */
  readonly lateMean: number;
  /** Absolute delta = lateMean - earlyMean. */
  readonly delta: number;
  /** Fractional drift = delta / |earlyMean|. */
  readonly drift: number;
  /** True if no drift regression was detected. */
  readonly passed: boolean;
  /** Human-readable reason. */
  readonly reason: string;
  /**
   * True when we had < 2*windowSize samples and skipped the check
   * (not enough data to compute distinct early and late windows).
   */
  readonly skipped: boolean;
}

/**
 * Compute drift between the earliest and latest windows of a numeric
 * series. Returns `skipped: true` when the series is too short to
 * compute distinct windows.
 */
export function detectDrift(
  values: ReadonlyArray<number>,
  options: DriftDetectionOptions = {},
): DriftDetectionResult {
  const windowSize = options.windowSize ?? 3;
  const threshold = options.threshold ?? 0.15;
  const direction = options.direction ?? 'higher';

  const finite = values.filter(v => Number.isFinite(v));
  // Need at least 2 * windowSize samples for distinct early + late windows.
  if (finite.length < 2 * windowSize) {
    return {
      sampleCount: finite.length,
      earlyMean: 0,
      lateMean: 0,
      delta: 0,
      drift: 0,
      passed: true,
      reason: `skipped — only ${finite.length} samples, need ≥${2 * windowSize} for windowSize=${windowSize}`,
      skipped: true,
    };
  }

  const earlySlice = finite.slice(0, windowSize);
  const lateSlice = finite.slice(-windowSize);
  const earlyMean = earlySlice.reduce((s, v) => s + v, 0) / earlySlice.length;
  const lateMean = lateSlice.reduce((s, v) => s + v, 0) / lateSlice.length;
  const delta = lateMean - earlyMean;
  const drift = earlyMean === 0
    ? (lateMean === 0 ? 0 : Infinity)
    : delta / Math.abs(earlyMean);

  let passed: boolean;
  let reason: string;
  if (direction === 'higher') {
    if (drift >= -threshold) {
      passed = true;
      const sign = drift >= 0 ? '+' : '';
      reason = `no significant drift — late mean ${lateMean.toFixed(4)} ${sign}${(drift * 100).toFixed(1)}% vs early mean ${earlyMean.toFixed(4)} (within ${(threshold * 100).toFixed(0)}% drift tolerance for higher-is-better)`;
    } else {
      passed = false;
      reason = `DRIFT DETECTED — late mean ${lateMean.toFixed(4)} dropped ${Math.abs(drift * 100).toFixed(1)}% from early mean ${earlyMean.toFixed(4)} (exceeds ${(threshold * 100).toFixed(0)}% drift threshold over ${finite.length} samples)`;
    }
  } else {
    if (drift <= threshold) {
      passed = true;
      const sign = drift >= 0 ? '+' : '';
      reason = `no significant drift — late mean ${lateMean.toFixed(4)} ${sign}${(drift * 100).toFixed(1)}% vs early mean ${earlyMean.toFixed(4)} (within ${(threshold * 100).toFixed(0)}% drift tolerance for lower-is-better)`;
    } else {
      passed = false;
      reason = `DRIFT DETECTED — late mean ${lateMean.toFixed(4)} grew ${(drift * 100).toFixed(1)}% from early mean ${earlyMean.toFixed(4)} (exceeds ${(threshold * 100).toFixed(0)}% drift threshold over ${finite.length} samples)`;
    }
  }

  return {
    sampleCount: finite.length,
    earlyMean,
    lateMean,
    delta,
    drift,
    passed,
    reason,
    skipped: false,
  };
}

/**
 * Produce a one-line summary of a benchmark metric's history: a
 * sparkline, the latest value, and the drift verdict. Useful for
 * dashboard / PR-comment output.
 */
export interface BenchmarkTrendSummary {
  readonly benchmark: string;
  readonly metricPath: string;
  readonly sparkline: string;
  readonly sampleCount: number;
  readonly latestValue: number | null;
  readonly drift: DriftDetectionResult;
}

export function summarizeBenchmarkTrend(
  values: ReadonlyArray<number>,
  benchmark: string,
  metricPath: string,
  options: DriftDetectionOptions = {},
): BenchmarkTrendSummary {
  return {
    benchmark,
    metricPath,
    sparkline: renderSparkline(values),
    sampleCount: values.length,
    latestValue: values.length > 0 ? values[values.length - 1]! : null,
    drift: detectDrift(values, options),
  };
}
