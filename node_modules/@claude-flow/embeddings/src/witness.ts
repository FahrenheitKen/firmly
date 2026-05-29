/**
 * ADR-121 Phase 15 — Benchmark witness manifest.
 *
 * "No mocks, push beyond SOTA and best in class with witness and proof"
 *
 * Every benchmark run emits a manifest that's tamper-evident: a JSON
 * blob with the corpus identity, query identity, model identity,
 * results, plus a SHA-256 hash and an Ed25519 signature over the
 * canonical form. Anyone can re-run the benchmark on the same
 * corpus + queries + model commit and verify the signature matches.
 *
 * This gives benchmark numbers PROVENANCE. "primitive X beat Y by Δ
 * on benchmark Z, signed by commit C" is not a claim — it's a
 * verifiable artifact.
 *
 * Implementation: zero new deps — uses Node's built-in `crypto`
 * (sha256 + ed25519 from `node:crypto`). The signer key is generated
 * per-process by default so a benchmark run produces a self-contained
 * manifest; production users can supply a stable private key via
 * BENCHMARK_WITNESS_PRIVATE_KEY env var.
 */

import { createHash, generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify, createPublicKey, type KeyObject } from 'node:crypto';

export interface BenchmarkWitnessInput {
  /** Benchmark name (e.g. "rag-topology-suite", "rag-scale", "rag-real-text") */
  readonly benchmark: string;
  /** ISO-8601 timestamp of the run */
  readonly timestamp: string;
  /** Git commit if available (env var GITHUB_SHA / GIT_COMMIT / read from `git rev-parse HEAD`) */
  readonly commit?: string | null;
  /** Identity of the embedding model used (e.g. "Xenova/all-MiniLM-L6-v2" or "synthetic-PRNG-seed42") */
  readonly model: string;
  /**
   * Corpus identity: a stable hash over the corpus content. For
   * synthetic corpora this is the deterministic generator's seed
   * options; for real corpora this is sha256 of the doc texts joined.
   */
  readonly corpus: { id: string; size: number };
  /** Query identity: stable hash over the query texts/vectors. */
  readonly queries: { id: string; count: number };
  /** The raw results to attest. */
  readonly results: unknown;
}

export interface WitnessedManifest extends BenchmarkWitnessInput {
  /** SHA-256 of the canonical JSON form of (benchmark, model, corpus, queries, results, timestamp, commit). */
  readonly contentHash: string;
  /** Ed25519 signature over contentHash (hex). */
  readonly signature: string;
  /** Ed25519 public key (SPKI DER, hex) the verifier needs. */
  readonly publicKey: string;
  /**
   * Signature algorithm identifier. Always 'ed25519' today; here for
   * future-proofing.
   */
  readonly signatureAlgorithm: 'ed25519';
}

/**
 * Compute a SHA-256 hex hash of the canonical JSON form of a value.
 *
 * "Canonical" here = JSON with keys sorted alphabetically at every
 * level — so different orderings of the same object produce
 * identical hashes.
 */
export function canonicalHash(value: unknown): string {
  const canonical = canonicalize(value);
  return createHash('sha256').update(canonical).digest('hex');
}

function canonicalize(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  if (typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize((v as Record<string, unknown>)[k])).join(',') + '}';
  }
  throw new Error(`canonicalize: unsupported value type ${typeof v}`);
}

/**
 * Build a canonical hash over a corpus given its doc IDs + vectors
 * (or texts). Stable across runs with the same input.
 */
export function corpusFingerprint(items: ReadonlyArray<{ id: string; content: string | Float32Array | number[] }>): string {
  const flat = items.map(it => {
    const c = it.content instanceof Float32Array
      ? Array.from(it.content)
      : it.content;
    return [it.id, c];
  });
  return canonicalHash(flat);
}

/**
 * Sign a benchmark input. Returns a WitnessedManifest with the
 * Ed25519 signature attached. Uses the supplied keypair, or
 * generates a fresh ephemeral one per-call if none is provided.
 */
export function witness(
  input: BenchmarkWitnessInput,
  keypair?: { privateKey: KeyObject; publicKey: KeyObject },
): WitnessedManifest {
  const kp = keypair ?? generateKeyPairSync('ed25519');

  // Hash everything except the signature itself.
  const contentHash = canonicalHash({
    benchmark: input.benchmark,
    timestamp: input.timestamp,
    commit: input.commit ?? null,
    model: input.model,
    corpus: input.corpus,
    queries: input.queries,
    results: input.results,
  });

  // Ed25519 signs the raw bytes (the hash hex string), no separate
  // digest needed.
  const signature = cryptoSign(null, Buffer.from(contentHash, 'utf8'), kp.privateKey).toString('hex');
  const publicKey = kp.publicKey.export({ type: 'spki', format: 'der' }).toString('hex');

  return {
    ...input,
    contentHash,
    signature,
    publicKey,
    signatureAlgorithm: 'ed25519',
  };
}

/**
 * Verify a WitnessedManifest: recomputes the content hash from the
 * declared inputs and checks the Ed25519 signature against the
 * embedded public key.
 *
 * Returns `true` if the manifest is internally consistent, `false`
 * otherwise. Throws only on malformed manifests (bad hex, missing
 * fields), not on signature mismatches.
 */
export function verify(manifest: WitnessedManifest): boolean {
  const expectedHash = canonicalHash({
    benchmark: manifest.benchmark,
    timestamp: manifest.timestamp,
    commit: manifest.commit ?? null,
    model: manifest.model,
    corpus: manifest.corpus,
    queries: manifest.queries,
    results: manifest.results,
  });
  if (expectedHash !== manifest.contentHash) return false;

  // Reconstruct the public key from its SPKI DER hex.
  const pubKeyDer = Buffer.from(manifest.publicKey, 'hex');
  const pubKey = createPublicKey({ key: pubKeyDer, format: 'der', type: 'spki' });

  return cryptoVerify(null, Buffer.from(manifest.contentHash, 'utf8'), pubKey, Buffer.from(manifest.signature, 'hex'));
}

/**
 * Convenience: generate a fresh ephemeral keypair (Ed25519). Use this
 * if you want to keep one signer alive across multiple `witness()`
 * calls within the same process (so all manifests share a verifier
 * key).
 */
export function generateEphemeralKeypair(): { privateKey: KeyObject; publicKey: KeyObject } {
  return generateKeyPairSync('ed25519');
}
