/**
 * RVFA Runner -- Boot and run self-contained Ruflo appliances.
 *
 * Supports three run modes (cli, mcp, verify) and two isolation
 * strategies (native Node.js, container via Docker).
 *
 * @module @claude-flow/cli/appliance/rvfa-runner
 */
import type { RvfaHeader } from './rvfa-format.js';
export interface RunOptions {
    mode: 'cli' | 'mcp' | 'verify';
    isolation: 'container' | 'native';
    verbose?: boolean;
    /** Passphrase for decrypting the API-key vault in the models section. */
    passphrase?: string;
}
export interface RunResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    /** Wall-clock duration in milliseconds. */
    duration: number;
}
export declare class RvfaRunner {
    private reader;
    private header;
    private constructor();
    /** Read and parse an RVFA file from disk. Throws on invalid input. */
    static fromFile(rvfaPath: string): Promise<RvfaRunner>;
    /** Create a runner from an already-loaded buffer. */
    static fromBuffer(buf: Buffer): RvfaRunner;
    /**
     * Boot the appliance: verify integrity, then dispatch to the
     * requested isolation strategy and run mode.
     */
    boot(options: RunOptions): Promise<RunResult>;
    /**
     * Run natively via Node.js: extract RUFLO section to a temp dir,
     * configure env vars, optionally decrypt API-key vault, and spawn.
     */
    runNative(options: RunOptions): Promise<RunResult>;
    /**
     * Run in a Docker container: generate a Dockerfile from the
     * extracted sections, build the image, and run it.
     */
    runContainer(options: RunOptions): Promise<RunResult>;
    /**
     * Run the verification suite. Extracts the VERIFY section and
     * executes it; falls back to a basic integrity report.
     */
    runVerify(options: RunOptions): Promise<RunResult>;
    /** Return appliance metadata without booting. */
    getInfo(): {
        header: RvfaHeader;
        sections: {
            id: string;
            size: number;
            originalSize: number;
        }[];
        totalSize: number;
    };
    /**
     * Decrypt an API-key vault (AES-256-GCM).
     * Layout: [16-byte IV][ciphertext][16-byte auth-tag]
     * Key derived via PBKDF2 with salt = "rvfa-vault-{name}".
     */
    private decryptVault;
}
//# sourceMappingURL=rvfa-runner.d.ts.map