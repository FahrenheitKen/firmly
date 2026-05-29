/**
 * ADR-121 Phase 15 — witness manifest tests.
 *
 * Verifies the contract: round-trip (witness → verify) returns true;
 * tampering with any field (results, hash, signature) returns false;
 * canonicalization is order-independent.
 */

import { describe, it, expect } from 'vitest';
import {
  witness,
  verify,
  canonicalHash,
  corpusFingerprint,
  generateEphemeralKeypair,
} from '../witness.js';

function input(overrides = {}) {
  return {
    benchmark: 'test-benchmark',
    timestamp: '2026-05-17T20:00:00.000Z',
    commit: 'abc123',
    model: 'Xenova/all-MiniLM-L6-v2',
    corpus: { id: 'fp-corpus-aaa', size: 100 },
    queries: { id: 'fp-queries-bbb', count: 10 },
    results: { recall: 0.85, ndcg: 0.92 },
    ...overrides,
  };
}

describe('canonicalHash — determinism', () => {
  it('is order-independent for objects', () => {
    expect(canonicalHash({ a: 1, b: 2 })).toBe(canonicalHash({ b: 2, a: 1 }));
  });

  it('is sensitive to value differences', () => {
    expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 2 }));
  });

  it('is sensitive to type differences', () => {
    expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: '1' }));
  });

  it('handles arrays', () => {
    expect(canonicalHash([1, 2, 3])).toBe(canonicalHash([1, 2, 3]));
    expect(canonicalHash([1, 2, 3])).not.toBe(canonicalHash([3, 2, 1]));
  });

  it('handles nested structures', () => {
    expect(canonicalHash({ a: { b: { c: [1, 2] } } })).toBe(
      canonicalHash({ a: { b: { c: [1, 2] } } }),
    );
  });

  it('produces a 64-char hex string (sha-256)', () => {
    const h = canonicalHash({ x: 1 });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('corpusFingerprint', () => {
  it('produces the same hash for the same docs in the same order', () => {
    const items = [
      { id: 'a', content: 'foo' },
      { id: 'b', content: 'bar' },
    ];
    expect(corpusFingerprint(items)).toBe(corpusFingerprint(items));
  });

  it('is sensitive to content changes', () => {
    expect(corpusFingerprint([{ id: 'a', content: 'foo' }])).not.toBe(
      corpusFingerprint([{ id: 'a', content: 'bar' }]),
    );
  });

  it('accepts Float32Array content', () => {
    const v = new Float32Array([0.1, 0.2, 0.3]);
    const h = corpusFingerprint([{ id: 'a', content: v }]);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('witness → verify round trip', () => {
  it('verify returns true on an untampered manifest', () => {
    const m = witness(input());
    expect(verify(m)).toBe(true);
  });

  it('manifest has expected fields', () => {
    const m = witness(input());
    expect(m.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(m.signature).toMatch(/^[0-9a-f]+$/);
    expect(m.publicKey).toMatch(/^[0-9a-f]+$/);
    expect(m.signatureAlgorithm).toBe('ed25519');
  });

  it('reuses a provided keypair', () => {
    const kp = generateEphemeralKeypair();
    const m1 = witness(input(), kp);
    const m2 = witness(input({ benchmark: 'other' }), kp);
    expect(m1.publicKey).toBe(m2.publicKey);
  });

  it('verify returns false when results are tampered', () => {
    const m = witness(input());
    const tampered = { ...m, results: { recall: 0.99, ndcg: 0.99 } };
    expect(verify(tampered)).toBe(false);
  });

  it('verify returns false when content hash is tampered', () => {
    const m = witness(input());
    const tampered = { ...m, contentHash: 'ff'.repeat(32) };
    expect(verify(tampered)).toBe(false);
  });

  it('verify returns false when signature is tampered', () => {
    const m = witness(input());
    const sigBytes = Buffer.from(m.signature, 'hex');
    sigBytes[0] = sigBytes[0]! ^ 0xff;
    const tampered = { ...m, signature: sigBytes.toString('hex') };
    expect(verify(tampered)).toBe(false);
  });

  it('verify returns false when benchmark name is tampered', () => {
    const m = witness(input());
    const tampered = { ...m, benchmark: 'different' };
    expect(verify(tampered)).toBe(false);
  });

  it('verify returns false when corpus id is tampered', () => {
    const m = witness(input());
    const tampered = { ...m, corpus: { id: 'spoof', size: m.corpus.size } };
    expect(verify(tampered)).toBe(false);
  });
});

describe('witness — null/undefined safety', () => {
  it('handles null commit', () => {
    const m = witness(input({ commit: null }));
    expect(verify(m)).toBe(true);
  });

  it('handles undefined commit (treated as null)', () => {
    const m = witness(input({ commit: undefined }));
    expect(verify(m)).toBe(true);
  });
});
