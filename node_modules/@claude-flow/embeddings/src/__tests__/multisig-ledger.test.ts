/**
 * ADR-121 Phase 24 — Multi-signer ledger tests.
 *
 * Covers:
 *  - Backward compat: existing single-signer entries still verify at minSignatures=1
 *  - coSign() doesn't change contentHash (chain integrity preserved)
 *  - Multiple co-signatures accumulate
 *  - Threshold verification (1-of-N, 2-of-N, M-of-N)
 *  - Invalid cosignature detected (forged signature, mismatched key)
 *  - verifyCosignatureAgainst standalone helper
 *  - Backward compat at ledger level: 9-entry single-sig ledger still verifies
 */

import { describe, it, expect } from 'vitest';
import {
  appendToLedger,
  verifyEntry,
  verifyLedger,
  generateLedgerKeypair,
  coSign,
  verifyCosignatureAgainst,
  type BenchmarkLedger,
} from '../witness-ledger.js';

function input(name: string, ts: string, results: unknown) {
  return {
    benchmark: name,
    timestamp: ts,
    commit: 'commit-abc',
    model: 'test-model',
    corpus: { id: 'fp-corpus', size: 10 },
    queries: { id: 'fp-queries', count: 3 },
    results,
  };
}

describe('coSign — chain integrity', () => {
  it('does not change the entry contentHash', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    const cosigner = generateLedgerKeypair();
    const cosigned = coSign(entry, cosigner, { signerLabel: 'third-party-verifier' });
    expect(cosigned.contentHash).toBe(entry.contentHash);
  });

  it('does not change the primary signature', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    const cosigner = generateLedgerKeypair();
    const cosigned = coSign(entry, cosigner);
    expect(cosigned.signature).toBe(entry.signature);
    expect(cosigned.publicKey).toBe(entry.publicKey);
  });

  it('appends to cosignatures array', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    expect(entry.cosignatures).toBeUndefined();
    const c1 = coSign(entry, generateLedgerKeypair());
    expect(c1.cosignatures?.length).toBe(1);
    const c2 = coSign(c1, generateLedgerKeypair());
    expect(c2.cosignatures?.length).toBe(2);
  });

  it('preserves signerLabel when provided', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    const cosigned = coSign(entry, generateLedgerKeypair(), { signerLabel: 'auditor-1' });
    expect(cosigned.cosignatures![0]!.signerLabel).toBe('auditor-1');
  });

  it('records signedAt timestamp', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    const cosigned = coSign(entry, generateLedgerKeypair(), { signedAt: '2026-02-01T00:00:00.000Z' });
    expect(cosigned.cosignatures![0]!.signedAt).toBe('2026-02-01T00:00:00.000Z');
  });
});

describe('verifyEntry — threshold semantics', () => {
  it('default (minSignatures=1) verifies single-signer entries (backward compat)', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    expect(verifyEntry(entry)).toBe(true);
  });

  it('minSignatures=1 verifies entry with 0 cosignatures', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    expect(verifyEntry(entry, { minSignatures: 1 })).toBe(true);
  });

  it('minSignatures=2 FAILS on single-signer entry', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    expect(verifyEntry(entry, { minSignatures: 2 })).toBe(false);
  });

  it('minSignatures=2 PASSES on entry with 1 valid cosignature (2 total)', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    const cosigned = coSign(entry, generateLedgerKeypair(), { signerLabel: 'auditor' });
    expect(verifyEntry(cosigned, { minSignatures: 2 })).toBe(true);
  });

  it('minSignatures=3 PASSES on entry with 2 valid cosignatures (3 total)', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    const c1 = coSign(entry, generateLedgerKeypair(), { signerLabel: 'auditor-A' });
    const c2 = coSign(c1, generateLedgerKeypair(), { signerLabel: 'auditor-B' });
    expect(verifyEntry(c2, { minSignatures: 3 })).toBe(true);
    expect(verifyEntry(c2, { minSignatures: 4 })).toBe(false);
  });

  it('minSignatures=0 trivially passes', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    expect(verifyEntry(entry, { minSignatures: 0 })).toBe(true);
  });
});

describe('verifyEntry — tampered cosignatures', () => {
  it('detects a forged cosignature (random bytes)', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    const cosigner = generateLedgerKeypair();
    const cosigned = coSign(entry, cosigner);
    // Tamper the cosignature bytes
    const cs = cosigned.cosignatures![0]!;
    const tamperedSig = Buffer.from(cs.signature, 'hex');
    tamperedSig[0] = tamperedSig[0]! ^ 0xff;
    const tampered = {
      ...cosigned,
      cosignatures: [{ ...cs, signature: tamperedSig.toString('hex') }],
    };
    // Primary still valid (1 sig); cosignature invalid (0 sigs from cosig).
    // Total valid = 1.
    expect(verifyEntry(tampered, { minSignatures: 1 })).toBe(true);  // primary still OK
    expect(verifyEntry(tampered, { minSignatures: 2 })).toBe(false); // cosig forged
  });

  it('detects mismatched public key on cosignature', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    const cosignerA = generateLedgerKeypair();
    const cosignerB = generateLedgerKeypair();
    const cosigned = coSign(entry, cosignerA);
    // Swap in B's public key while keeping A's signature
    const cs = cosigned.cosignatures![0]!;
    const bPubKey = cosignerB.publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
    const swapped = {
      ...cosigned,
      cosignatures: [{ ...cs, publicKey: bPubKey }],
    };
    expect(verifyEntry(swapped, { minSignatures: 2 })).toBe(false);
  });

  it('partial validity: 2 valid + 1 forged cosig, minSignatures=3 → fails', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    let cur = entry;
    cur = coSign(cur, generateLedgerKeypair()); // valid
    cur = coSign(cur, generateLedgerKeypair()); // valid
    // Add a forged third
    const fake = generateLedgerKeypair();
    cur = coSign(cur, fake);
    // Tamper its signature
    const tail = cur.cosignatures!.slice();
    const forged = tail[tail.length - 1]!;
    const sigBytes = Buffer.from(forged.signature, 'hex');
    sigBytes[0] = sigBytes[0]! ^ 0xff;
    tail[tail.length - 1] = { ...forged, signature: sigBytes.toString('hex') };
    const tampered = { ...cur, cosignatures: tail };
    // Primary + 2 valid cosigs = 3 valid
    expect(verifyEntry(tampered, { minSignatures: 3 })).toBe(true);
    expect(verifyEntry(tampered, { minSignatures: 4 })).toBe(false);
  });
});

describe('verifyCosignatureAgainst — standalone helper', () => {
  it('returns true for valid cosignature against the right hash', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    const cosigner = generateLedgerKeypair();
    const cosigned = coSign(entry, cosigner);
    expect(verifyCosignatureAgainst(entry.contentHash, cosigned.cosignatures![0]!)).toBe(true);
  });

  it('returns false against a different contentHash', () => {
    const { entry } = appendToLedger(undefined, input('b1', '2026-01-01T00:00:00Z', { r: 1 }));
    const cosigner = generateLedgerKeypair();
    const cosigned = coSign(entry, cosigner);
    expect(verifyCosignatureAgainst('ff'.repeat(32), cosigned.cosignatures![0]!)).toBe(false);
  });

  it('returns false on malformed inputs (does not throw)', () => {
    const bad = { signature: 'not-hex', publicKey: 'also-not-hex', signedAt: '' };
    expect(verifyCosignatureAgainst('ff'.repeat(32), bad)).toBe(false);
  });
});

describe('verifyLedger — threshold over the chain', () => {
  function makeChain(n: number): BenchmarkLedger {
    const kp = generateLedgerKeypair();
    let ledger: BenchmarkLedger | undefined;
    for (let i = 0; i < n; i++) {
      ledger = appendToLedger(ledger, input(`b${i}`, `2026-01-0${i + 1}T00:00:00Z`, { i }), kp).ledger;
    }
    return ledger!;
  }

  it('minSignatures=1 (default) verifies a single-signer chain (backward compat)', () => {
    const ledger = makeChain(3);
    const r = verifyLedger(ledger);
    expect(r.valid).toBe(true);
  });

  it('minSignatures=2 fails when no entries have cosignatures', () => {
    const ledger = makeChain(3);
    const r = verifyLedger(ledger, { minSignatures: 2 });
    expect(r.valid).toBe(false);
    expect(r.firstFailureAt).toBe(0);
    expect(r.reason).toMatch(/minSignatures=2/);
  });

  it('minSignatures=2 passes when every entry is cosigned', () => {
    const ledger = makeChain(3);
    const cosigner = generateLedgerKeypair();
    const cosigned: BenchmarkLedger = {
      ...ledger,
      entries: ledger.entries.map(e => coSign(e, cosigner, { signerLabel: 'auditor' })),
    };
    const r = verifyLedger(cosigned, { minSignatures: 2 });
    expect(r.valid).toBe(true);
  });

  it('reports the first entry that fails the threshold', () => {
    const ledger = makeChain(3);
    const cosigner = generateLedgerKeypair();
    // Only entries 0 and 2 are co-signed; entry 1 has just the primary.
    const cosigned: BenchmarkLedger = {
      ...ledger,
      entries: [
        coSign(ledger.entries[0]!, cosigner),
        ledger.entries[1]!,
        coSign(ledger.entries[2]!, cosigner),
      ],
    };
    const r = verifyLedger(cosigned, { minSignatures: 2 });
    expect(r.valid).toBe(false);
    expect(r.firstFailureAt).toBe(1);
  });
});
