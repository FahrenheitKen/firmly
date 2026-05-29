/**
 * ADR-121 Phase 12 — averageEmbeddings (HyDE) tests.
 *
 * Coverage:
 *  - Single vector returns (a normalized copy of) the input
 *  - N orthogonal unit vectors average to their geometric centroid
 *  - normalizeOutput=true produces a unit vector
 *  - normalizeOutput=false returns the raw mean
 *  - normalizeInputs=true makes magnitude irrelevant (only direction matters)
 *  - normalizeInputs=false → larger-magnitude vectors dominate
 *  - weights bias the result toward higher-weighted vectors
 *  - all-zero weights returns zero vector (no NaN)
 *  - dimension mismatch throws
 *  - empty input throws
 *  - negative weights throw
 *  - weights length mismatch throws
 *  - isUnitNorm helper correctness
 */

import { describe, it, expect } from 'vitest';
import { averageEmbeddings, isUnitNorm } from '../embedding-fusion.js';

function vec(n: number, fill: (i: number) => number): Float32Array {
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = fill(i);
  return v;
}

describe('averageEmbeddings — basic contract', () => {
  it('throws on empty vectors array', () => {
    expect(() => averageEmbeddings([])).toThrow(/non-empty/);
  });

  it('throws on dimension mismatch', () => {
    expect(() => averageEmbeddings([
      new Float32Array([1, 0, 0]),
      new Float32Array([0, 1]),
    ])).toThrow(/dim/);
  });

  it('throws on weights length mismatch', () => {
    expect(() => averageEmbeddings(
      [new Float32Array([1, 0]), new Float32Array([0, 1])],
      { weights: [1] },
    )).toThrow(/weights\.length/);
  });

  it('throws on negative weights', () => {
    expect(() => averageEmbeddings(
      [new Float32Array([1, 0])],
      { weights: [-1] },
    )).toThrow(/negative/);
  });
});

describe('averageEmbeddings — single vector', () => {
  it('single vector returns the same direction (normalized)', () => {
    const v = new Float32Array([3, 0, 0, 0]);
    const out = averageEmbeddings([v]);
    expect(out[0]).toBeCloseTo(1, 6);
    expect(out[1]).toBeCloseTo(0, 6);
    expect(isUnitNorm(out)).toBe(true);
  });

  it('does not mutate the input vector', () => {
    const v = new Float32Array([3, 0, 0, 0]);
    const copy = new Float32Array(v);
    averageEmbeddings([v]);
    expect(v).toEqual(copy);
  });
});

describe('averageEmbeddings — multi-vector centroid', () => {
  it('two orthogonal unit vectors average to their normalized midpoint', () => {
    const a = new Float32Array([1, 0, 0, 0]);
    const b = new Float32Array([0, 1, 0, 0]);
    const out = averageEmbeddings([a, b], { normalizeInputs: true, normalizeOutput: true });
    // Mean = [0.5, 0.5, 0, 0]; norm = sqrt(0.5) ≈ 0.7071;
    // normalized = [0.7071, 0.7071, 0, 0]
    expect(out[0]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(out[1]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(out[2]).toBeCloseTo(0, 6);
    expect(isUnitNorm(out)).toBe(true);
  });

  it('three vectors at orthogonal axes give the (1,1,1)/sqrt(3) centroid', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    const c = new Float32Array([0, 0, 1]);
    const out = averageEmbeddings([a, b, c]);
    const v = 1 / Math.sqrt(3);
    expect(out[0]).toBeCloseTo(v, 5);
    expect(out[1]).toBeCloseTo(v, 5);
    expect(out[2]).toBeCloseTo(v, 5);
  });
});

describe('averageEmbeddings — normalizeInputs', () => {
  it('normalizeInputs=true: magnitude does not matter, only direction', () => {
    // Two vectors pointing the same way but with very different
    // magnitudes — with normalization, they're equivalent.
    const a = new Float32Array([10, 0, 0]); // big mag, x-axis
    const b = new Float32Array([0.001, 0, 0]); // tiny mag, x-axis
    const out = averageEmbeddings([a, b], { normalizeInputs: true, normalizeOutput: true });
    expect(out[0]).toBeCloseTo(1, 5);
    expect(out[1]).toBeCloseTo(0, 5);
  });

  it('normalizeInputs=false: larger-magnitude vectors dominate', () => {
    // Without normalization, the big-mag vector should pull the
    // result strongly toward its direction.
    const big = new Float32Array([100, 0, 0]);
    const small = new Float32Array([0, 1, 0]);
    const out = averageEmbeddings([big, small], {
      normalizeInputs: false,
      normalizeOutput: true,
    });
    // Mean = [50, 0.5, 0]; normalized: x ≈ 0.99995, y ≈ 0.00999
    expect(out[0]).toBeGreaterThan(0.99);
    expect(out[1]).toBeLessThan(0.05);
  });
});

describe('averageEmbeddings — weights', () => {
  it('uniform weights match default behavior', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    const def = averageEmbeddings([a, b]);
    const uni = averageEmbeddings([a, b], { weights: [1, 1] });
    expect(uni[0]).toBeCloseTo(def[0]!, 6);
    expect(uni[1]).toBeCloseTo(def[1]!, 6);
  });

  it('weight bias shifts the result toward the heavier vector', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    const out = averageEmbeddings([a, b], { weights: [10, 1] });
    // With 10:1 bias, x-component should dominate
    expect(out[0]).toBeGreaterThan(out[1]!);
  });

  it('weight=0 effectively removes a vector', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    const out = averageEmbeddings([a, b], { weights: [1, 0] });
    expect(out[0]).toBeCloseTo(1, 5);
    expect(out[1]).toBeCloseTo(0, 5);
  });

  it('all-zero weights returns zero vector without NaN', () => {
    const a = new Float32Array([1, 0, 0]);
    const out = averageEmbeddings([a], { weights: [0] });
    expect(out[0]).toBe(0);
    expect(Number.isNaN(out[0])).toBe(false);
  });
});

describe('averageEmbeddings — normalizeOutput', () => {
  it('normalizeOutput=true produces a unit vector', () => {
    const out = averageEmbeddings([
      new Float32Array([1, 0, 0]),
      new Float32Array([0, 1, 0]),
    ], { normalizeOutput: true });
    expect(isUnitNorm(out)).toBe(true);
  });

  it('normalizeOutput=false returns the raw mean', () => {
    const out = averageEmbeddings([
      new Float32Array([1, 0, 0]),
      new Float32Array([0, 1, 0]),
    ], { normalizeOutput: false, normalizeInputs: true });
    // Mean of two unit vectors at right angles: [0.5, 0.5, 0]
    expect(out[0]).toBeCloseTo(0.5, 5);
    expect(out[1]).toBeCloseTo(0.5, 5);
    expect(isUnitNorm(out)).toBe(false);
  });
});

describe('averageEmbeddings — number[] input', () => {
  it('accepts number[] just like Float32Array', () => {
    const out = averageEmbeddings([[1, 0, 0], [0, 1, 0]]);
    expect(out[0]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(out[1]).toBeCloseTo(Math.SQRT1_2, 5);
  });
});

describe('isUnitNorm', () => {
  it('true for unit vectors', () => {
    expect(isUnitNorm(new Float32Array([1, 0, 0]))).toBe(true);
    expect(isUnitNorm(new Float32Array([Math.SQRT1_2, Math.SQRT1_2]))).toBe(true);
  });
  it('false for non-unit vectors', () => {
    expect(isUnitNorm(new Float32Array([2, 0, 0]))).toBe(false);
    expect(isUnitNorm(new Float32Array([0, 0, 0]))).toBe(false);
  });
  it('respects tolerance', () => {
    // Within default 1e-5 tolerance:
    expect(isUnitNorm(new Float32Array([1 + 1e-7, 0, 0]))).toBe(true);
    // Outside:
    expect(isUnitNorm(new Float32Array([1.01, 0, 0]))).toBe(false);
  });
});
