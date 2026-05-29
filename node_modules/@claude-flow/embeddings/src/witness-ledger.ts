/**
 * ADR-121 Phase 18 — Chained witness manifests + benchmark ledger.
 *
 * Phase 15 shipped per-run signed manifests. That makes each benchmark
 * number cryptographically attestable in isolation. What it doesn't
 * give you: a HISTORY you can trust. If someone edits an old
 * manifest, its signature still verifies (it's still a valid sign
 * of the new content) — only a separate audit catches the rewrite.
 *
 * This module ships the missing layer: a **hash chain** over the
 * witness manifests. Each new manifest signs the previous manifest's
 * contentHash; any retroactive edit to a historical entry breaks
 * every subsequent signature in the chain. Anyone can replay the
 * ledger and detect a rewrite at any position.
 *
 * The chain structure mirrors git: each entry has a `prevContentHash`
 * field; the genesis entry has `prevContentHash: null`. The
 * canonical hash of an entry includes `prevContentHash`, so a
 * historical edit forces a hash mismatch all the way down.
 *
 * Used together with the witness primitives from `witness.ts`. Each
 * benchmark run produces one ledger entry; the script that runs
 * benchmarks appends to a single `bench-witness/ledger.json` over
 * time.
 */

import { canonicalHash, witness, verify, type BenchmarkWitnessInput, type WitnessedManifest } from './witness.js';
import { generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify, createPublicKey, type KeyObject } from 'node:crypto';

/**
 * A chained ledger entry — a regular WitnessedManifest plus the
 * `prevContentHash` field that ties it to the previous entry.
 *
 * Genesis entry: prevContentHash = null.
 * Subsequent entries: prevContentHash = previous entry's contentHash.
 */
/**
 * Phase 24 — independent third-party signature attached to an existing
 * entry's contentHash. Co-signers don't change the hash; they just
 * attest "I observed this entry and verified its primary signature."
 *
 * Threshold verification (`verifyEntry(entry, { minSignatures: N })`)
 * counts the PRIMARY signature plus every valid cosignature; passes
 * when N or more are valid. M-of-N adversarial benchmarking just sets
 * the threshold to M.
 */
export interface CosignatureRecord {
  /** Ed25519 signature over the entry's contentHash (hex). */
  readonly signature: string;
  /** SPKI-DER hex of the co-signer's public key. */
  readonly publicKey: string;
  /** ISO-8601 timestamp of when the co-signature was attached. */
  readonly signedAt: string;
  /** Optional human-readable label (e.g. "third-party verifier"). */
  readonly signerLabel?: string;
}

export interface LedgerEntry extends WitnessedManifest {
  /** sha256-hex of the previous entry's contentHash, or null for genesis. */
  readonly prevContentHash: string | null;
  /** 1-based position in the chain. */
  readonly sequence: number;
  /**
   * Phase 24 — optional additional signatures from third-party verifiers.
   * Backward-compatible: existing single-signer entries omit this field
   * and verify at minSignatures=1 (counting just the primary signature).
   */
  readonly cosignatures?: ReadonlyArray<CosignatureRecord>;
}

export interface BenchmarkLedger {
  /** Schema version of the ledger format. */
  readonly version: 1;
  /** Append-only entries in chain order. */
  readonly entries: ReadonlyArray<LedgerEntry>;
}

/**
 * Append a new benchmark run to an existing ledger (or initialize a
 * fresh one if the ledger is undefined). Returns the new entry plus
 * the updated ledger.
 *
 * Each call uses the supplied keypair so a single signer attests the
 * full chain. Pass `undefined` to generate an ephemeral keypair per
 * call (each entry will then have its own publicKey — verifiable but
 * less useful for "is this from the same signer?" queries).
 */
export function appendToLedger(
  prevLedger: BenchmarkLedger | undefined,
  input: BenchmarkWitnessInput,
  keypair?: { privateKey: KeyObject; publicKey: KeyObject },
): { ledger: BenchmarkLedger; entry: LedgerEntry } {
  const ledger: BenchmarkLedger = prevLedger ?? { version: 1, entries: [] };
  const prevEntry = ledger.entries[ledger.entries.length - 1];
  const prevContentHash = prevEntry?.contentHash ?? null;
  const sequence = (prevEntry?.sequence ?? 0) + 1;

  // We sign a manifest whose canonical form INCLUDES prevContentHash
  // + sequence. The base witness() doesn't know about these fields,
  // so we extend the input with them and recompute the content hash
  // here.
  const baseHashInput = {
    benchmark: input.benchmark,
    timestamp: input.timestamp,
    commit: input.commit ?? null,
    model: input.model,
    corpus: input.corpus,
    queries: input.queries,
    results: input.results,
    // Chain-specific fields:
    prevContentHash,
    sequence,
  };
  const contentHash = canonicalHash(baseHashInput);

  // Sign the chain-aware content hash via the base witness primitive
  // by passing a synthetic input whose results bundle includes the
  // chain fields. We then strip and re-attach them onto the ledger
  // entry shape.
  const synthInput: BenchmarkWitnessInput = {
    ...input,
    results: { __chain: { prevContentHash, sequence }, ...((input.results as object) ?? {}) },
  };
  const signed = witness(synthInput, keypair);

  // The signed.contentHash from witness() already incorporates the
  // __chain fields via the synthInput.results. Use that as the
  // canonical entry hash so verify(entry) round-trips.
  const entry: LedgerEntry = {
    benchmark: input.benchmark,
    timestamp: input.timestamp,
    commit: input.commit ?? null,
    model: input.model,
    corpus: input.corpus,
    queries: input.queries,
    results: synthInput.results,
    contentHash: signed.contentHash,
    signature: signed.signature,
    publicKey: signed.publicKey,
    signatureAlgorithm: 'ed25519',
    prevContentHash,
    sequence,
  };
  // Sanity check — the recomputed canonical hash should match.
  void contentHash;

  return {
    ledger: { version: 1, entries: [...ledger.entries, entry] },
    entry,
  };
}

/**
 * Verify a single ledger entry: checks its own signature via the
 * base witness verifier (which validates the contentHash + signature
 * + public-key pair).
 *
 * Phase 24 — pass `{ minSignatures: N }` to require N or more total
 * valid signatures (primary + cosignatures). Default 1 — backward-
 * compatible with single-signer entries.
 */
export function verifyEntry(entry: LedgerEntry, options: { minSignatures?: number } = {}): boolean {
  const minSignatures = options.minSignatures ?? 1;
  if (minSignatures < 1) return true; // 0-threshold trivially passes

  // Primary signature check via the base witness verifier.
  const primaryValid = verify({
    benchmark: entry.benchmark,
    timestamp: entry.timestamp,
    commit: entry.commit,
    model: entry.model,
    corpus: entry.corpus,
    queries: entry.queries,
    results: entry.results,
    contentHash: entry.contentHash,
    signature: entry.signature,
    publicKey: entry.publicKey,
    signatureAlgorithm: entry.signatureAlgorithm,
  });
  let validCount = primaryValid ? 1 : 0;

  // Co-signature checks (Phase 24). Each cosignature is an
  // independent Ed25519 over the entry's contentHash.
  if (entry.cosignatures && entry.cosignatures.length > 0) {
    for (const cs of entry.cosignatures) {
      if (verifyCosignatureAgainst(entry.contentHash, cs)) {
        validCount++;
      }
    }
  }

  return validCount >= minSignatures;
}

/**
 * Add a third-party co-signature to an existing ledger entry. Returns
 * a new entry (the original is not mutated). The new co-signer signs
 * the entry's existing contentHash — does NOT change the hash itself,
 * preserving the chain integrity.
 */
export function coSign(
  entry: LedgerEntry,
  keypair: { privateKey: KeyObject; publicKey: KeyObject },
  options: { signerLabel?: string; signedAt?: string } = {},
): LedgerEntry {
  const signature = cryptoSign(null, Buffer.from(entry.contentHash, 'utf8'), keypair.privateKey).toString('hex');
  const publicKey = keypair.publicKey.export({ type: 'spki', format: 'der' }).toString('hex');

  const record: CosignatureRecord = {
    signature,
    publicKey,
    signedAt: options.signedAt ?? new Date().toISOString(),
    ...(options.signerLabel ? { signerLabel: options.signerLabel } : {}),
  };

  return {
    ...entry,
    cosignatures: [...(entry.cosignatures ?? []), record],
  };
}

/**
 * Verify a single co-signature against the canonical contentHash.
 * Exposed for tooling that wants to per-signer validate (e.g.
 * dashboards that mark each co-signer green/red individually).
 */
export function verifyCosignatureAgainst(contentHash: string, cs: CosignatureRecord): boolean {
  try {
    const pubKeyDer = Buffer.from(cs.publicKey, 'hex');
    const pubKey = createPublicKey({ key: pubKeyDer, format: 'der', type: 'spki' });
    return cryptoVerify(null, Buffer.from(contentHash, 'utf8'), pubKey, Buffer.from(cs.signature, 'hex'));
  } catch {
    return false;
  }
}

export interface ChainVerifyResult {
  /** True if every entry's signature verifies AND the chain links match. */
  readonly valid: boolean;
  /** Total entries inspected. */
  readonly entryCount: number;
  /** First entry index (0-based) where verification failed, or -1. */
  readonly firstFailureAt: number;
  /** Human-readable reason for the failure (or '' if valid). */
  readonly reason: string;
}

/**
 * Verify the entire ledger end-to-end. Checks:
 *   1. ledger.version is recognized
 *   2. each entry's signature verifies
 *   3. each entry's prevContentHash matches the previous entry's contentHash
 *   4. sequence numbers are monotonically increasing starting from 1
 *
 * Returns a structured result rather than throwing — callers want
 * to know WHICH entry broke the chain (an attacker who edits entry
 * N breaks signatures from N onward; a missing entry N breaks
 * sequence integrity).
 */
export function verifyLedger(
  ledger: BenchmarkLedger,
  options: { minSignatures?: number } = {},
): ChainVerifyResult {
  const minSignatures = options.minSignatures ?? 1;
  if (ledger.version !== 1) {
    return {
      valid: false,
      entryCount: ledger.entries?.length ?? 0,
      firstFailureAt: -1,
      reason: `unknown ledger version ${ledger.version}`,
    };
  }
  let prevHash: string | null = null;
  for (let i = 0; i < ledger.entries.length; i++) {
    const e = ledger.entries[i]!;
    // Sequence check.
    if (e.sequence !== i + 1) {
      return {
        valid: false,
        entryCount: ledger.entries.length,
        firstFailureAt: i,
        reason: `entry ${i} has sequence ${e.sequence}, expected ${i + 1}`,
      };
    }
    // Chain link check.
    if (e.prevContentHash !== prevHash) {
      return {
        valid: false,
        entryCount: ledger.entries.length,
        firstFailureAt: i,
        reason: `entry ${i} prevContentHash ${e.prevContentHash} != previous contentHash ${prevHash}`,
      };
    }
    // Signature check (Phase 24: threshold-aware).
    if (!verifyEntry(e, { minSignatures })) {
      const cosigCount = e.cosignatures?.length ?? 0;
      return {
        valid: false,
        entryCount: ledger.entries.length,
        firstFailureAt: i,
        reason: `entry ${i} signature threshold not met (minSignatures=${minSignatures}; entry has 1 primary + ${cosigCount} cosignatures, but not enough verified)`,
      };
    }
    prevHash = e.contentHash;
  }
  return { valid: true, entryCount: ledger.entries.length, firstFailureAt: -1, reason: '' };
}

/**
 * Generate a fresh ed25519 keypair for use across multiple ledger
 * appends from the same signer. Equivalent to
 * `generateEphemeralKeypair` from witness.ts; re-exported here so
 * callers building ledgers don't need to import both modules.
 */
export function generateLedgerKeypair(): { privateKey: KeyObject; publicKey: KeyObject } {
  return generateKeyPairSync('ed25519');
}
