/**
 * RVFA (RuVector Format Appliance) — Binary format reader/writer
 * for self-contained Ruflo appliances.
 *
 * Binary layout:
 *   [4B magic "RVFA"] [4B version u32LE] [4B header_len u32LE]
 *   [header_len B JSON header] [section data ...] [32B SHA256 footer]
 */
export declare const RVFA_MAGIC: Buffer<ArrayBuffer>;
export declare const RVFA_VERSION = 1;
export interface RvfaHeader {
    magic: string;
    version: number;
    name: string;
    appVersion: string;
    arch: string;
    platform: string;
    profile: 'cloud' | 'hybrid' | 'offline';
    created: string;
    sections: RvfaSection[];
    boot: RvfaBootConfig;
    models: RvfaModelConfig;
    capabilities: string[];
}
export interface RvfaSection {
    id: string;
    type: string;
    offset: number;
    size: number;
    originalSize: number;
    sha256: string;
    compression: 'none' | 'gzip' | 'zstd';
}
export interface RvfaBootConfig {
    entrypoint: string;
    args: string[];
    env: Record<string, string>;
    isolation: 'container' | 'microvm' | 'native';
}
export interface RvfaModelConfig {
    provider: 'ruvllm' | 'api-vault' | 'hybrid';
    engine?: string;
    models?: string[];
    vaultEncryption?: string;
}
/** Format bytes into a human-readable string (e.g. '2.3 GB'). */
export declare function formatSize(bytes: number): string;
/** Create a sensible default header for a given profile. */
export declare function createDefaultHeader(profile: 'cloud' | 'hybrid' | 'offline'): RvfaHeader;
/** Type-guard that validates an unknown value is a well-formed RvfaHeader. */
export declare function validateHeader(header: unknown): header is RvfaHeader;
export declare class RvfaWriter {
    private header;
    private staged;
    constructor(partial: Partial<RvfaHeader>);
    /**
     * Add a section to the appliance image.
     *
     * @param id      Section identifier (e.g. 'kernel', 'runtime', 'ruflo').
     * @param data    Raw (uncompressed) section payload.
     * @param options Optional compression and MIME type overrides.
     */
    addSection(id: string, data: Buffer, options?: {
        compression?: 'none' | 'gzip' | 'zstd';
        type?: string;
    }): void;
    /**
     * Assemble the final RVFA binary image.
     *
     * Layout:
     *   [4B magic] [4B version] [4B header_len]
     *   [header JSON bytes]
     *   [section 0 bytes] [section 1 bytes] ...
     *   [32B SHA256 of all section bytes combined]
     */
    build(): Buffer;
}
export declare class RvfaReader {
    private buf;
    private header;
    private constructor();
    /** Parse an RVFA image from an in-memory Buffer. */
    static fromBuffer(buf: Buffer): RvfaReader;
    /** Read an RVFA image from a file path. */
    static fromFile(path: string): Promise<RvfaReader>;
    /** Return the parsed header. */
    getHeader(): RvfaHeader;
    /** List all sections declared in the header. */
    getSections(): RvfaSection[];
    /**
     * Extract and decompress a section by its id.
     *
     * @param id  The section identifier (e.g. 'kernel', 'runtime').
     * @returns   The decompressed section payload.
     */
    extractSection(id: string): Buffer;
    /**
     * Verify the integrity of the RVFA image.
     *
     * Checks:
     *  1. Magic bytes
     *  2. Version number
     *  3. SHA256 of each section's compressed data
     *  4. SHA256 footer (all section data combined)
     */
    verify(): {
        valid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=rvfa-format.d.ts.map