/**
 * RVFA Appliance Builder -- Constructs self-contained .rvf appliance files.
 *
 * Creates a single binary containing kernel, runtime, Ruflo CLI, models/keys,
 * AgentDB data, and the verification suite. See ADR-058.
 */
export interface BuildOptions {
    profile: 'cloud' | 'hybrid' | 'offline';
    arch: string;
    output: string;
    rufloVersion?: string;
    models?: string[];
    apiKeys?: string;
    verbose?: boolean;
}
export interface BuildResult {
    outputPath: string;
    size: number;
    sections: {
        id: string;
        size: number;
        originalSize: number;
    }[];
    duration: number;
    profile: string;
}
/** Encrypt API keys from a .env file. Output: salt(32)+iv(16)+tag(16)+ciphertext */
export declare function encryptApiKeys(envPath: string, passphrase: string): Buffer;
/** Decrypt API keys previously encrypted with encryptApiKeys. */
export declare function decryptApiKeys(buf: Buffer, passphrase: string): Record<string, string>;
export declare class RvfaBuilder {
    private opts;
    constructor(options: BuildOptions);
    build(): Promise<BuildResult>;
    private buildKernelSection;
    private buildRuntimeSection;
    private buildRufloSection;
    private buildModelsSection;
    private buildDataSection;
    private buildVerifySection;
    private buildHeaderPartial;
    private log;
}
//# sourceMappingURL=rvfa-builder.d.ts.map