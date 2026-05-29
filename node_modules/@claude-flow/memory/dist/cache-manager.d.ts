/**
 * V3 Cache Manager
 *
 * High-performance LRU cache with TTL support, memory pressure handling,
 * and write-through caching for the unified memory system.
 *
 * @module v3/memory/cache-manager
 */
import { EventEmitter } from 'node:events';
import { CacheConfig, CacheStats, MemoryEntry } from './types.js';
/**
 * High-performance LRU Cache with TTL support
 *
 * Features:
 * - O(1) get, set, delete operations
 * - LRU eviction policy
 * - TTL-based expiration
 * - Memory pressure handling
 * - Write-through caching support
 * - Performance statistics
 */
export declare class CacheManager<T = MemoryEntry> extends EventEmitter {
    private config;
    private cache;
    private head;
    private tail;
    private currentMemory;
    private stats;
    private cleanupInterval;
    constructor(config?: Partial<CacheConfig>);
    /**
     * Get a value from the cache
     */
    get(key: string): T | null;
    /**
     * Set a value in the cache
     */
    set(key: string, data: T, ttl?: number): void;
    /**
     * Delete a value from the cache
     */
    delete(key: string): boolean;
    /**
     * Check if a key exists in the cache (without affecting LRU order)
     */
    has(key: string): boolean;
    /**
     * Clear all entries from the cache
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Get all keys in the cache
     */
    keys(): string[];
    /**
     * Get the size of the cache
     */
    get size(): number;
    /**
     * Prefetch multiple keys in a single batch
     */
    prefetch(keys: string[], loader: (keys: string[]) => Promise<Map<string, T>>, ttl?: number): Promise<void>;
    /**
     * Get or set pattern - get from cache or load and cache
     */
    getOrSet(key: string, loader: () => Promise<T>, ttl?: number): Promise<T>;
    /**
     * Warm the cache with initial data
     */
    warmUp(entries: Array<{
        key: string;
        data: T;
        ttl?: number;
    }>): void;
    /**
     * Invalidate entries matching a pattern
     */
    invalidatePattern(pattern: string | RegExp): number;
    /**
     * Shutdown the cache manager
     */
    shutdown(): void;
    private mergeConfig;
    private isExpired;
    private estimateSize;
    private addToFront;
    private removeNode;
    private moveToFront;
    private evictLRU;
    private startCleanupTimer;
    private cleanupExpired;
}
/**
 * Multi-layer cache with L1 (memory) and L2 (storage) tiers
 */
export declare class TieredCacheManager<T = MemoryEntry> extends EventEmitter {
    private l1Cache;
    private l2Loader;
    private l2Writer;
    constructor(l1Config?: Partial<CacheConfig>, l2Options?: {
        loader: (key: string) => Promise<T | null>;
        writer?: (key: string, value: T) => Promise<void>;
    });
    /**
     * Get from tiered cache
     */
    get(key: string): Promise<T | null>;
    /**
     * Set in tiered cache
     */
    set(key: string, value: T, ttl?: number): Promise<void>;
    /**
     * Delete from tiered cache
     */
    delete(key: string): boolean;
    /**
     * Get L1 cache statistics
     */
    getStats(): CacheStats;
    /**
     * Clear L1 cache
     */
    clear(): void;
    /**
     * Shutdown tiered cache
     */
    shutdown(): void;
}
export default CacheManager;
//# sourceMappingURL=cache-manager.d.ts.map