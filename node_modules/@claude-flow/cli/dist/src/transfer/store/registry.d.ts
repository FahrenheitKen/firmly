/**
 * Decentralized Pattern Registry
 * IPFS-based registry with IPNS for mutable references
 */
import type { PatternRegistry, PatternEntry, PatternCategory, KnownRegistry, StoreConfig } from './types.js';
/**
 * Registry version
 */
export declare const REGISTRY_VERSION = "1.0.0";
/**
 * Default bootstrap registries for discovery
 */
export declare const BOOTSTRAP_REGISTRIES: KnownRegistry[];
/**
 * Default store configuration
 */
export declare const DEFAULT_STORE_CONFIG: StoreConfig;
/**
 * Create a new empty registry
 */
export declare function createRegistry(ipnsName: string): PatternRegistry;
/**
 * Default pattern categories
 */
export declare function getDefaultCategories(): PatternCategory[];
/**
 * Add a pattern to the registry
 */
export declare function addPatternToRegistry(registry: PatternRegistry, entry: PatternEntry): PatternRegistry;
/**
 * Remove a pattern from the registry
 */
export declare function removePatternFromRegistry(registry: PatternRegistry, patternId: string): PatternRegistry;
/**
 * Serialize registry to JSON
 */
export declare function serializeRegistry(registry: PatternRegistry): string;
/**
 * Deserialize registry from JSON
 */
export declare function deserializeRegistry(json: string): PatternRegistry;
/**
 * Sign registry with private key
 */
export declare function signRegistry(registry: PatternRegistry, privateKey: string): PatternRegistry;
/**
 * Verify registry signature
 */
export declare function verifyRegistrySignature(registry: PatternRegistry): boolean;
/**
 * Merge two registries (for sync)
 */
export declare function mergeRegistries(local: PatternRegistry, remote: PatternRegistry): PatternRegistry;
/**
 * Generate pattern ID from name
 */
export declare function generatePatternId(name: string): string;
//# sourceMappingURL=registry.d.ts.map