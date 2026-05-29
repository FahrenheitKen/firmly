/**
 * Encryption-at-rest vault primitives (ADR-096 Phase 1).
 *
 * Goal: provide deterministic encrypt/decrypt of arbitrary Buffers with a
 * symmetric key, using a magic-byte format so readers of older plaintext
 * stores can detect-then-pass-through during the migration window.
 *
 * Phase 1 deliberately ships only the cipher primitives + the env-var key
 * source. Keychain (keytar) and interactive passphrase resolution land in
 * a follow-up iteration so the blast radius of this commit is limited to
 * a single self-contained module with no native dependencies.
 *
 * Wire format (output of encryptBuffer):
 *
 *   +---------+-----------+----------------+--------+
 *   | magic 4 |   iv 12   |  ciphertext N  | tag 16 |
 *   +---------+-----------+----------------+--------+
 *      "RFE1"   random       AES-256-GCM     GCM
 *
 * The magic distinguishes encrypted blobs from plaintext during the
 * incremental migration: readers call isEncryptedBlob() and either
 * decryptBuffer() or treat the bytes as plaintext, so existing
 * .claude-flow/sessions/*.json files keep working unchanged.
 */
/** ASCII "RFE1" — Ruflo File Encrypted v1. 4 bytes. */
export declare const MAGIC: Buffer<ArrayBuffer>;
/**
 * True when at-rest encryption should be applied to writes.
 *
 * Truthy values: "1", "true", "yes", "on" (case-insensitive). Anything else
 * — including unset — keeps the legacy plaintext path. This is the gate
 * that lets the 1865-test baseline keep passing unchanged while users opt
 * into encryption.
 */
export declare function isEncryptionEnabled(): boolean;
/**
 * Resolve a 32-byte encryption key from CLAUDE_FLOW_ENCRYPTION_KEY.
 *
 * Phase 1 supports only the env-var source; keychain and passphrase
 * resolution are deferred to a follow-up iteration (see ADR-096). When
 * encryption is enabled but no key resolves, this throws with a clear
 * message rather than silently falling back to plaintext (fail-closed).
 *
 * Accepted encodings (auto-detected by length):
 *   - 64-char hex (32 bytes)
 *   - 44-char base64 (32 bytes + padding)
 *   - exactly 32 raw bytes (rare; for callers that pre-decode)
 *
 * Anything else is rejected — we'd rather fail loudly than encrypt with a
 * truncated key.
 */
export declare function getKey(): Buffer;
/**
 * Decode a key string. Exposed for testing and for the future passphrase
 * resolver, which will scrypt-derive a Buffer and hand it back through here
 * to share the same length-check.
 */
export declare function decodeKey(raw: string): Buffer;
/**
 * Encrypt a plaintext Buffer with AES-256-GCM. Returns the wire-format
 * blob: magic(4) || iv(12) || ciphertext(N) || tag(16).
 *
 * The IV is freshly randomized per call. Reusing a (key, iv) pair under
 * GCM is catastrophic — every call MUST produce a different IV. Node's
 * randomBytes is csprng-backed so this is automatic; the function takes
 * no IV input deliberately.
 */
export declare function encryptBuffer(plaintext: Buffer, key: Buffer): Buffer;
/**
 * Decrypt a wire-format blob. Verifies the magic byte (sanity), parses
 * iv + ciphertext + tag, runs AES-256-GCM decrypt, and lets the GCM
 * auth tag fail loudly on tamper (Node throws "Unsupported state or
 * unable to authenticate data" — we let that propagate).
 *
 * Pre-condition: caller has already determined this is an encrypted
 * blob via isEncryptedBlob(). decryptBuffer throws on bad magic so a
 * mistaken plaintext blob still fails loudly rather than producing
 * garbage.
 */
export declare function decryptBuffer(blob: Buffer, key: Buffer): Buffer;
/**
 * Magic-byte sniff. True iff the blob starts with the RFE1 magic AND is
 * long enough to be a valid encrypted blob. Used by readers during the
 * incremental migration: legacy plaintext files return false and flow
 * through the existing read path unchanged.
 *
 * Note: this is a heuristic. A plaintext file that happens to start with
 * "RFE1" would be misdetected — we accept that vanishingly small risk
 * because (a) the four bytes 0x52,0x46,0x45,0x31 are an unusual prefix
 * for JSON (`{`, `[`) or SQLite (`SQLite format 3`), and (b) decryption
 * will then fail with a clear error rather than silently corrupt.
 */
export declare function isEncryptedBlob(blob: Buffer): boolean;
//# sourceMappingURL=vault.d.ts.map