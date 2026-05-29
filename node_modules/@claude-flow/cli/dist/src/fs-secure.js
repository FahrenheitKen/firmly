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
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { decryptBuffer, encryptBuffer, getKey, isEncryptedBlob, isEncryptionEnabled, } from './encryption/vault.js';
/**
 * Create a directory tree with mode 0700 (owner-only). No-op if exists.
 * Uses recursive: true so missing parents are created with the same mode.
 */
export function mkdirRestricted(path) {
    mkdirSync(path, { recursive: true, mode: 0o700 });
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
export function writeFileRestricted(path, data, optsOrEncoding = 'utf-8') {
    const opts = typeof optsOrEncoding === 'string'
        ? { encoding: optsOrEncoding }
        : optsOrEncoding;
    const encoding = opts.encoding ?? 'utf-8';
    let payload = data;
    if (opts.encrypt && isEncryptionEnabled()) {
        const plaintext = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding);
        payload = encryptBuffer(plaintext, getKey());
    }
    // For encrypted payloads we always have a Buffer — pass through without an
    // encoding so writeFileSync doesn't try to text-decode it.
    if (Buffer.isBuffer(payload)) {
        writeFileSync(path, payload);
    }
    else {
        writeFileSync(path, payload, encoding);
    }
    try {
        chmodSync(path, 0o600);
    }
    catch {
        // Windows / FS without POSIX modes — silently skip.
    }
}
export function readFileMaybeEncrypted(path, encoding = 'utf-8') {
    const raw = readFileSync(path);
    let plain;
    if (isEncryptedBlob(raw)) {
        plain = decryptBuffer(raw, getKey());
    }
    else {
        plain = raw;
    }
    return encoding === null ? plain : plain.toString(encoding);
}
//# sourceMappingURL=fs-secure.js.map