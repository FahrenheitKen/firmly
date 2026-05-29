/**
 * V3 Configuration Loader
 * Load configuration from various sources
 */
import type { SystemConfig } from './schema.js';
/**
 * Configuration source type
 */
export type ConfigSource = 'file' | 'env' | 'default' | 'merged';
/**
 * Loaded configuration with metadata
 */
export interface LoadedConfig {
    config: SystemConfig;
    source: ConfigSource;
    path?: string;
    warnings?: string[];
}
/**
 * Configuration loader class
 */
export declare class ConfigLoader {
    private searchPaths;
    constructor(additionalPaths?: string[]);
    /**
     * Load configuration from all sources
     */
    load(): Promise<LoadedConfig>;
    /**
     * Load configuration from specific file
     */
    loadFromFile(filePath: string): Promise<LoadedConfig>;
    /**
     * Deep merge objects
     */
    private deepMerge;
}
/**
 * Load configuration (convenience function)
 */
export declare function loadConfig(options?: {
    paths?: string[];
    file?: string;
}): Promise<LoadedConfig>;
//# sourceMappingURL=loader.d.ts.map