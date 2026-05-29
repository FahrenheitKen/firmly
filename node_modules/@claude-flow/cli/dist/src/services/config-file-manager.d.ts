/**
 * Config File Manager
 * Shared JSON config file persistence with atomic writes and Zod validation
 */
export declare class ConfigFileManager {
    private configPath;
    private config;
    /** Find config file in search paths starting from cwd */
    findConfig(cwd: string): string | null;
    /** Load config from file, returns null if not found */
    load(cwd: string): Record<string, unknown> | null;
    /** Get the current config, loading if needed */
    getConfig(cwd: string): Record<string, unknown>;
    /** Get a nested config value by dot-separated key */
    get(cwd: string, key: string): unknown;
    /** Set a nested config value by dot-separated key */
    set(cwd: string, key: string, value: unknown): void;
    /** Create a new config file with defaults */
    create(cwd: string, overrides?: Record<string, unknown>, force?: boolean): string;
    /** Reset config to defaults */
    reset(cwd: string): string;
    /** Export config to a specific path */
    exportTo(cwd: string, exportPath: string): void;
    /** Import config from a specific path */
    importFrom(cwd: string, importPath: string): void;
    /** Get the path to the current config file */
    getConfigPath(): string | null;
    /** Get default config */
    getDefaults(): Record<string, unknown>;
    /** Atomic write: write to .tmp then rename */
    private writeAtomic;
}
/** Parse a string value to the appropriate type */
export declare function parseConfigValue(value: string): unknown;
/** Singleton instance */
export declare const configManager: ConfigFileManager;
//# sourceMappingURL=config-file-manager.d.ts.map