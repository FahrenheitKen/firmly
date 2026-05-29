/**
 * Restricted-permission file helpers.
 *
 * audit_1776853149979: session/memory/terminal stores were written with the
 * process umask, which on most macOS/Linux setups leaves them world-readable
 * (mode 0644). They contain conversation snapshots, agent prompts, and
 * terminal command history — anyone else on the host can read them.
 *
 * These helpers write atomically and force mode 0600 (files) / 0700 (dirs).
 * chmod fails silently on Windows, where POSIX modes don't apply — that's
 * fine, the OS-level ACL surface there is different.
 *
 * ADR-096 Phase 2: optional opt-in encryption-at-rest. When the caller
 * passes `encrypt: true` AND the env-gated vault is enabled, payloads are
 * AES-256-GCM-encrypted before hitting disk. Reads use the magic-byte
 * sniff so legacy plaintext files keep working unchanged during the
 * incremental migration.
 */
/**
 * Create a directory tree with mode 0700 (owner-only). No-op if exists.
 * Uses recursive: true so missing parents are created with the same mode.
 */
export declare function mkdirRestricted(path: string): void;
/**
 * Options for writeFileRestricted. Object form so we can grow the API
 * without churning every call site.
 */
export interface WriteOptions {
    /** Buffer encoding when `data` is a string. Ignored for Buffer payloads. */
    encoding?: BufferEncoding;
    /**
     * If true AND encryption is globally enabled (CLAUDE_FLOW_ENCRYPT_AT_REST),
     * encrypt the payload with AES-256-GCM before writing. If encryption is
     * NOT enabled, this flag is silently ignored — the legacy plaintext path
     * runs unchanged. Default: false.
     */
    encrypt?: boolean;
}
/**
 * Write a file and tighten its permissions to mode 0600 (owner read/write).
 *
 * Two call signatures, both supported (the legacy positional one keeps
 * existing call sites working without churn):
 *
 *   writeFileRestricted(path, data)                      // plaintext, utf-8
 *   writeFileRestricted(path, data, 'utf-8')             // legacy: encoding only
 *   writeFileRestricted(path, data, { encrypt: true })   // opt-in encryption
 */
export declare function writeFileRestricted(path: string, data: string | Buffer, optsOrEncoding?: BufferEncoding | WriteOptions): void;
/**
 * Read a file and transparently decrypt if it carries the RFE1 magic.
 *
 * Returns a string when the caller asks for one (default utf-8). Returns
 * a Buffer when `encoding` is null. This matches Node's readFileSync
 * shape so the function is a near-drop-in replacement.
 *
 * Migration semantics:
 *   - If the file IS encrypted, decrypt and return.
 *   - If the file is NOT encrypted, return its raw bytes (string-decoded
 *     under `encoding` if requested).
 *
 * That means a reader can be migrated *first*, before its writer flips
 * `encrypt: true`, without breaking on the legacy plaintext path.
 */
export declare function readFileMaybeEncrypted(path: string, encoding?: BufferEncoding): string;
export declare function readFileMaybeEncrypted(path: string, encoding: null): Buffer;
//# sourceMappingURL=fs-secure.d.ts.map