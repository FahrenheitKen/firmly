/**
 * RVFA Ed25519 Code Signing -- Digital signatures for RVFA appliance files.
 *
 * Provides tamper detection and publisher identity verification using
 * Ed25519 (RFC 8032) via Node.js native crypto. Zero external dependencies.
 *
 * @module @claude-flow/cli/appliance/rvfa-signing
 */
import { generateKeyPairSync, createHash, sign, verify, createPublicKey, createPrivateKey, } from 'node:crypto';
import { readFile, writeFile, stat, chmod, mkdir } from 'node:fs/promises';
// ── Constants ────────────────────────────────────────────────
const PREAMBLE_SIZE = 12; // 4B magic + 4B version + 4B header_len
const SHA256_SIZE = 32;
const KEY_FILE_MODE = 0o600;
// ── Key Management ───────────────────────────────────────────
/** Compute the fingerprint of a public key: first 16 hex chars of its SHA256. */
function computeFingerprint(publicKeyPem) {
    return createHash('sha256')
        .update(publicKeyPem, 'utf-8')
        .digest('hex')
        .slice(0, 16);
}
/**
 * Generate a new Ed25519 key pair for RVFA signing.
 */
export async function generateKeyPair() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const pubBuf = Buffer.from(publicKey, 'utf-8');
    const privBuf = Buffer.from(privateKey, 'utf-8');
    const fingerprint = computeFingerprint(publicKey);
    return { publicKey: pubBuf, privateKey: privBuf, fingerprint };
}
/**
 * Save a key pair to disk as PEM files.
 *
 * @param keyPair  The key pair to persist.
 * @param dir      Directory to write files into.
 * @param name     Base name for the key files (default: 'rvfa-signing').
 * @returns Paths to the written public and private key files.
 */
export async function saveKeyPair(keyPair, dir, name = 'rvfa-signing') {
    await mkdir(dir, { recursive: true });
    const pubPath = `${dir}/${name}.pub`;
    const privPath = `${dir}/${name}.key`;
    await writeFile(pubPath, keyPair.publicKey);
    await writeFile(privPath, keyPair.privateKey, { mode: KEY_FILE_MODE });
    // Ensure private key has restrictive permissions even on existing files
    await chmod(privPath, KEY_FILE_MODE);
    return { publicKeyPath: pubPath, privateKeyPath: privPath };
}
/**
 * Load a key pair from PEM files on disk.
 *
 * @param dir   Directory containing the key files.
 * @param name  Base name for the key files (default: 'rvfa-signing').
 */
export async function loadKeyPair(dir, name = 'rvfa-signing') {
    const pubPath = `${dir}/${name}.pub`;
    const privPath = `${dir}/${name}.key`;
    const publicKey = await readFile(pubPath);
    const privateKey = await readFile(privPath);
    // Warn if private key permissions are too open
    const privStat = await stat(privPath);
    const mode = privStat.mode & 0o777;
    if (mode & 0o077) {
        console.warn(`[rvfa-signing] WARNING: Private key ${privPath} has open permissions ` +
            `(${mode.toString(8)}). Consider running: chmod 600 ${privPath}`);
    }
    const fingerprint = computeFingerprint(publicKey.toString('utf-8'));
    return { publicKey, privateKey, fingerprint };
}
/**
 * Load a public key from a single PEM file.
 */
export async function loadPublicKey(path) {
    return readFile(path);
}
// ── Internal Helpers ─────────────────────────────────────────
/**
 * Recursively sort object keys for canonical JSON serialization.
 * Produces deterministic output regardless of insertion order.
 */
function canonicalJson(value) {
    return JSON.stringify(value, (_key, val) => {
        if (val !== null && typeof val === 'object' && !Array.isArray(val) && !Buffer.isBuffer(val)) {
            const sorted = {};
            for (const k of Object.keys(val).sort()) {
                sorted[k] = val[k];
            }
            return sorted;
        }
        return val;
    });
}
/**
 * Parse an RVFA binary into its components without full validation.
 * Returns the header object, header JSON bytes, section data region, and footer.
 */
function parseRvfaBinary(buf) {
    if (buf.length < PREAMBLE_SIZE + SHA256_SIZE) {
        throw new Error('Buffer too small to be a valid RVFA file');
    }
    const magic = buf.subarray(0, 4).toString('ascii');
    if (magic !== 'RVFA') {
        throw new Error(`Invalid RVFA magic: expected "RVFA", got "${magic}"`);
    }
    const headerLen = buf.readUInt32LE(8);
    const headerStart = PREAMBLE_SIZE;
    const headerEnd = headerStart + headerLen;
    if (headerEnd > buf.length - SHA256_SIZE) {
        throw new Error('Header length extends beyond buffer');
    }
    const headerJson = buf.subarray(headerStart, headerEnd).toString('utf-8');
    let header;
    try {
        header = JSON.parse(headerJson);
    }
    catch {
        throw new Error('Failed to parse RVFA header JSON');
    }
    const footer = buf.subarray(buf.length - SHA256_SIZE);
    const sectionData = buf.subarray(headerEnd, buf.length - SHA256_SIZE);
    return { header, headerStart, headerEnd, sectionData, footer };
}
/**
 * Compute the signing digest for an RVFA file.
 *
 * The digest is SHA256 of: canonical_header_json (without signature field)
 *                         + section_data_bytes
 *                         + footer_32_bytes
 */
function computeSigningDigest(header, sectionData, footer) {
    // Strip signature field from header for digest computation
    const stripped = { ...header };
    delete stripped.signature;
    const canonical = Buffer.from(canonicalJson(stripped), 'utf-8');
    return createHash('sha256')
        .update(canonical)
        .update(sectionData)
        .update(footer)
        .digest();
}
/** Convert a Buffer or PEM string into a KeyObject. */
function toPrivateKeyObject(key) {
    const pem = Buffer.isBuffer(key) ? key.toString('utf-8') : key;
    return createPrivateKey(pem);
}
/** Convert a Buffer or PEM string into a KeyObject. */
function toPublicKeyObject(key) {
    const pem = Buffer.isBuffer(key) ? key.toString('utf-8') : key;
    return createPublicKey(pem);
}
/**
 * Rebuild the RVFA binary with an updated header.
 *
 * Preserves the original preamble version, recalculates header length,
 * and keeps section data and footer intact.
 */
function rebuildRvfa(originalBuf, newHeader, sectionData, footer) {
    const headerJson = Buffer.from(JSON.stringify(newHeader), 'utf-8');
    // Preamble: magic + version + new header length
    const preamble = Buffer.alloc(PREAMBLE_SIZE);
    originalBuf.copy(preamble, 0, 0, 8); // magic + version unchanged
    preamble.writeUInt32LE(headerJson.length, 8);
    return Buffer.concat([preamble, headerJson, sectionData, footer]);
}
// ── RvfaSigner ───────────────────────────────────────────────
/**
 * Signs RVFA appliance files and data with Ed25519.
 */
export class RvfaSigner {
    keyObj;
    fingerprint;
    constructor(privateKey) {
        this.keyObj = toPrivateKeyObject(privateKey);
        // Derive public key to compute fingerprint
        const pubPem = createPublicKey(this.keyObj)
            .export({ type: 'spki', format: 'pem' });
        this.fingerprint = computeFingerprint(pubPem);
    }
    /**
     * Sign an RVFA appliance file in-place.
     *
     * Algorithm:
     *  1. Read and parse the RVFA binary
     *  2. Strip any existing signature from the header
     *  3. Compute SHA256 of [canonical_header + section_data + footer]
     *  4. Sign the digest with Ed25519
     *  5. Embed signature metadata into the header
     *  6. Write the updated binary back to the file
     *
     * @param rvfaPath   Path to the .rvf appliance file.
     * @param signedBy   Optional publisher name.
     * @returns The signature metadata that was embedded.
     */
    async signAppliance(rvfaPath, signedBy) {
        const buf = await readFile(rvfaPath);
        const { header, sectionData, footer } = parseRvfaBinary(buf);
        // Compute digest over header (without signature) + sections + footer
        const digest = computeSigningDigest(header, sectionData, footer);
        // Ed25519 sign
        const sig = sign(null, digest, this.keyObj);
        const metadata = {
            algorithm: 'ed25519',
            publicKeyFingerprint: this.fingerprint,
            signature: sig.toString('hex'),
            signedAt: new Date().toISOString(),
            signedBy,
            scope: 'full',
        };
        // Embed signature in header and rebuild
        header.signature = metadata;
        const rebuilt = rebuildRvfa(buf, header, sectionData, footer);
        await writeFile(rvfaPath, rebuilt);
        return metadata;
    }
    /**
     * Sign a section footer hash (detached signature).
     *
     * @param footerHash  The 32-byte SHA256 footer hash from an RVFA file.
     * @returns Hex-encoded Ed25519 signature.
     */
    async signSections(footerHash) {
        if (footerHash.length !== SHA256_SIZE) {
            throw new Error(`Footer hash must be ${SHA256_SIZE} bytes, got ${footerHash.length}`);
        }
        const sig = sign(null, footerHash, this.keyObj);
        return sig.toString('hex');
    }
    /**
     * Sign an RVFP patch file (detached signature).
     *
     * @param patchData  The raw patch binary data.
     * @returns Hex-encoded Ed25519 signature.
     */
    async signPatch(patchData) {
        const digest = createHash('sha256').update(patchData).digest();
        const sig = sign(null, digest, this.keyObj);
        return sig.toString('hex');
    }
}
// ── RvfaVerifier ─────────────────────────────────────────────
/**
 * Verifies Ed25519 signatures on RVFA appliance files and data.
 */
export class RvfaVerifier {
    keyObj;
    fingerprint;
    constructor(publicKey) {
        this.keyObj = toPublicKeyObject(publicKey);
        const pem = Buffer.isBuffer(publicKey) ? publicKey.toString('utf-8') : publicKey;
        this.fingerprint = computeFingerprint(pem);
    }
    /**
     * Verify the Ed25519 signature embedded in an RVFA appliance file.
     *
     * @param rvfaPath  Path to the .rvf appliance file.
     * @returns Verification result with details and any errors.
     */
    async verifyAppliance(rvfaPath) {
        const errors = [];
        let buf;
        try {
            buf = await readFile(rvfaPath);
        }
        catch (err) {
            return { valid: false, errors: [`Failed to read file: ${err.message}`] };
        }
        let parsed;
        try {
            parsed = parseRvfaBinary(buf);
        }
        catch (err) {
            return { valid: false, errors: [`Invalid RVFA file: ${err.message}`] };
        }
        const { header, sectionData, footer } = parsed;
        // Extract signature metadata from header
        const sigRaw = header.signature;
        if (!sigRaw || typeof sigRaw !== 'object') {
            return { valid: false, errors: ['No signature found in RVFA header'] };
        }
        const sigMeta = sigRaw;
        if (sigMeta.algorithm !== 'ed25519') {
            errors.push(`Unsupported algorithm: ${String(sigMeta.algorithm)}`);
            return { valid: false, errors };
        }
        if (typeof sigMeta.signature !== 'string' || !sigMeta.signature) {
            errors.push('Signature field is missing or empty');
            return { valid: false, errors };
        }
        // Recompute the digest the same way the signer did
        const digest = computeSigningDigest(header, sectionData, footer);
        // Verify
        let sigBuf;
        try {
            sigBuf = Buffer.from(sigMeta.signature, 'hex');
        }
        catch {
            errors.push('Signature is not valid hex');
            return { valid: false, errors };
        }
        let valid;
        try {
            valid = verify(null, digest, this.keyObj, sigBuf);
        }
        catch (err) {
            errors.push(`Verification error: ${err.message}`);
            return { valid: false, errors };
        }
        if (!valid) {
            errors.push('Ed25519 signature verification failed: data may be tampered');
        }
        return {
            valid,
            signerFingerprint: sigMeta.publicKeyFingerprint,
            signedAt: sigMeta.signedAt,
            signedBy: sigMeta.signedBy,
            errors,
        };
    }
    /**
     * Verify a detached Ed25519 signature over arbitrary data.
     *
     * @param data       The data that was signed.
     * @param signature  Hex-encoded Ed25519 signature.
     */
    async verifyDetached(data, signature) {
        const digest = createHash('sha256').update(data).digest();
        const sigBuf = Buffer.from(signature, 'hex');
        return verify(null, digest, this.keyObj, sigBuf);
    }
    /**
     * Verify an RVFP patch file signature.
     *
     * @param patchData  The raw patch binary data.
     * @param signature  Hex-encoded Ed25519 signature.
     */
    async verifyPatch(patchData, signature) {
        const digest = createHash('sha256').update(patchData).digest();
        const sigBuf = Buffer.from(signature, 'hex');
        return verify(null, digest, this.keyObj, sigBuf);
    }
}
//# sourceMappingURL=rvfa-signing.js.map