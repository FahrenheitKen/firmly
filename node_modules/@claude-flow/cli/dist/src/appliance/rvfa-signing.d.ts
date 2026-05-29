/**
 * RVFA Ed25519 Code Signing -- Digital signatures for RVFA appliance files.
 *
 * Provides tamper detection and publisher identity verification using
 * Ed25519 (RFC 8032) via Node.js native crypto. Zero external dependencies.
 *
 * @module @claude-flow/cli/appliance/rvfa-signing
 */
export interface RvfaKeyPair {
    publicKey: Buffer;
    privateKey: Buffer;
    fingerprint: string;
}
export interface SignatureMetadata {
    algorithm: 'ed25519';
    publicKeyFingerprint: string;
    signature: string;
    signedAt: string;
    signedBy?: string;
    scope: 'full' | 'sections';
}
export interface VerifyResult {
    valid: boolean;
    signerFingerprint?: string;
    signedAt?: string;
    signedBy?: string;
    errors: string[];
}
/**
 * Generate a new Ed25519 key pair for RVFA signing.
 */
export declare function generateKeyPair(): Promise<RvfaKeyPair>;
/**
 * Save a key pair to disk as PEM files.
 *
 * @param keyPair  The key pair to persist.
 * @param dir      Directory to write files into.
 * @param name     Base name for the key files (default: 'rvfa-signing').
 * @returns Paths to the written public and private key files.
 */
export declare function saveKeyPair(keyPair: RvfaKeyPair, dir: string, name?: string): Promise<{
    publicKeyPath: string;
    privateKeyPath: string;
}>;
/**
 * Load a key pair from PEM files on disk.
 *
 * @param dir   Directory containing the key files.
 * @param name  Base name for the key files (default: 'rvfa-signing').
 */
export declare function loadKeyPair(dir: string, name?: string): Promise<RvfaKeyPair>;
/**
 * Load a public key from a single PEM file.
 */
export declare function loadPublicKey(path: string): Promise<Buffer>;
/**
 * Signs RVFA appliance files and data with Ed25519.
 */
export declare class RvfaSigner {
    private readonly keyObj;
    private readonly fingerprint;
    constructor(privateKey: Buffer | string);
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
    signAppliance(rvfaPath: string, signedBy?: string): Promise<SignatureMetadata>;
    /**
     * Sign a section footer hash (detached signature).
     *
     * @param footerHash  The 32-byte SHA256 footer hash from an RVFA file.
     * @returns Hex-encoded Ed25519 signature.
     */
    signSections(footerHash: Buffer): Promise<string>;
    /**
     * Sign an RVFP patch file (detached signature).
     *
     * @param patchData  The raw patch binary data.
     * @returns Hex-encoded Ed25519 signature.
     */
    signPatch(patchData: Buffer): Promise<string>;
}
/**
 * Verifies Ed25519 signatures on RVFA appliance files and data.
 */
export declare class RvfaVerifier {
    private readonly keyObj;
    private readonly fingerprint;
    constructor(publicKey: Buffer | string);
    /**
     * Verify the Ed25519 signature embedded in an RVFA appliance file.
     *
     * @param rvfaPath  Path to the .rvf appliance file.
     * @returns Verification result with details and any errors.
     */
    verifyAppliance(rvfaPath: string): Promise<VerifyResult>;
    /**
     * Verify a detached Ed25519 signature over arbitrary data.
     *
     * @param data       The data that was signed.
     * @param signature  Hex-encoded Ed25519 signature.
     */
    verifyDetached(data: Buffer, signature: string): Promise<boolean>;
    /**
     * Verify an RVFP patch file signature.
     *
     * @param patchData  The raw patch binary data.
     * @param signature  Hex-encoded Ed25519 signature.
     */
    verifyPatch(patchData: Buffer, signature: string): Promise<boolean>;
}
//# sourceMappingURL=rvfa-signing.d.ts.map