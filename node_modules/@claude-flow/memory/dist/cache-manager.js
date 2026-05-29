/**
 * V3 Cache Manager
 *
 * High-performance LRU cache with TTL support, memory pressure handling,
 * and write-through caching for the unified memory system.
 *
 * @module v3/memory/cache-manager
 */
import { EventEmitter } from 'node:events';
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
export class CacheManager extends EventEmitter {
    config;
    cache = new Map();
    head = null;
    tail = null;
    currentMemory = 0;
    // Statistics
    stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        expirations: 0,
        writes: 0,
    };
    // Cleanup timer
    cleanupInterval = null;
    constructor(config = {}) {
        super();
        this.config = this.mergeConfig(config);
        this.startCleanupTimer();
    }
    /**
     * Get a value from the cache
     */
    get(key) {
        const node = this.cache.get(key);
        if (!node) {
            this.stats.misses++;
            this.emit('cache:miss', { key });
            return null;
        }
        // Check if expired
        if (this.isExpired(node.value)) {
            this.delete(key);
            this.stats.misses++;
            this.stats.expirations++;
            this.emit('cache:expired', { key });
            return null;
        }
        // Update access time and count
        node.value.lastAccessedAt = Date.now();
        node.value.accessCount++;
        // Move to front (most recently used)
        this.moveToFront(node);
        this.stats.hits++;
        this.emit('cache:hit', { key });
        return node.value.data;
    }
    /**
     * Set a value in the cache
     */
    set(key, data, ttl) {
        const now = Date.now();
        const entryTtl = ttl || this.config.ttl;
        // Check if key already exists
        const existingNode = this.cache.get(key);
        if (existingNode) {
            // Update existing entry
            existingNode.value.data = data;
            existingNode.value.cachedAt = now;
            existingNode.value.expiresAt = now + entryTtl;
            existingNode.value.lastAccessedAt = now;
            this.moveToFront(existingNode);
            this.stats.writes++;
            return;
        }
        // Calculate memory for new entry
        const entryMemory = this.estimateSize(data);
        // Evict entries if needed for memory pressure
        if (this.config.maxMemory) {
            while (this.currentMemory + entryMemory > this.config.maxMemory &&
                this.cache.size > 0) {
                this.evictLRU();
            }
        }
        // Evict entries if at capacity
        while (this.cache.size >= this.config.maxSize) {
            this.evictLRU();
        }
        // Create new node
        const cachedEntry = {
            data,
            cachedAt: now,
            expiresAt: now + entryTtl,
            lastAccessedAt: now,
            accessCount: 0,
        };
        const node = {
            key,
            value: cachedEntry,
            prev: null,
            next: null,
        };
        // Add to cache
        this.cache.set(key, node);
        this.addToFront(node);
        this.currentMemory += entryMemory;
        this.stats.writes++;
        this.emit('cache:set', { key, ttl: entryTtl });
    }
    /**
     * Delete a value from the cache
     */
    delete(key) {
        const node = this.cache.get(key);
        if (!node) {
            return false;
        }
        this.removeNode(node);
        this.cache.delete(key);
        this.currentMemory -= this.estimateSize(node.value.data);
        this.emit('cache:delete', { key });
        return true;
    }
    /**
     * Check if a key exists in the cache (without affecting LRU order)
     */
    has(key) {
        const node = this.cache.get(key);
        if (!node)
            return false;
        if (this.isExpired(node.value)) {
            this.delete(key);
            return false;
        }
        return true;
    }
    /**
     * Clear all entries from the cache
     */
    clear() {
        this.cache.clear();
        this.head = null;
        this.tail = null;
        this.currentMemory = 0;
        this.emit('cache:cleared', { previousSize: this.cache.size });
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            size: this.cache.size,
            hitRate: total > 0 ? this.stats.hits / total : 0,
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
            memoryUsage: this.currentMemory,
        };
    }
    /**
     * Get all keys in the cache
     */
    keys() {
        return Array.from(this.cache.keys());
    }
    /**
     * Get the size of the cache
     */
    get size() {
        return this.cache.size;
    }
    /**
     * Prefetch multiple keys in a single batch
     */
    async prefetch(keys, loader, ttl) {
        const missing = keys.filter((key) => !this.has(key));
        if (missing.length === 0) {
            return;
        }
        const data = await loader(missing);
        for (const [key, value] of data) {
            this.set(key, value, ttl);
        }
        this.emit('cache:prefetched', { keys: missing.length });
    }
    /**
     * Get or set pattern - get from cache or load and cache
     */
    async getOrSet(key, loader, ttl) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }
        const data = await loader();
        this.set(key, data, ttl);
        return data;
    }
    /**
     * Warm the cache with initial data
     */
    warmUp(entries) {
        for (const entry of entries) {
            this.set(entry.key, entry.data, entry.ttl);
        }
        this.emit('cache:warmedUp', { count: entries.length });
    }
    /**
     * Invalidate entries matching a pattern
     */
    invalidatePattern(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        let invalidated = 0;
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.delete(key);
                invalidated++;
            }
        }
        this.emit('cache:invalidated', { pattern: pattern.toString(), count: invalidated });
        return invalidated;
    }
    /**
     * Shutdown the cache manager
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clear();
        this.emit('cache:shutdown');
    }
    // ===== Private Methods =====
    mergeConfig(config) {
        return {
            maxSize: config.maxSize || 10000,
            ttl: config.ttl || 300000, // 5 minutes default
            lruEnabled: config.lruEnabled !== false,
            maxMemory: config.maxMemory,
            writeThrough: config.writeThrough || false,
        };
    }
    isExpired(entry) {
        return Date.now() > entry.expiresAt;
    }
    estimateSize(data) {
        try {
            return JSON.stringify(data).length * 2; // Rough UTF-16 estimate
        }
        catch {
            return 1000; // Default for non-serializable objects
        }
    }
    addToFront(node) {
        node.prev = null;
        node.next = this.head;
        if (this.head) {
            this.head.prev = node;
        }
        this.head = node;
        if (!this.tail) {
            this.tail = node;
        }
    }
    removeNode(node) {
        if (node.prev) {
            node.prev.next = node.next;
        }
        else {
            this.head = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }
        else {
            this.tail = node.prev;
        }
    }
    moveToFront(node) {
        if (node === this.head)
            return;
        this.removeNode(node);
        this.addToFront(node);
    }
    evictLRU() {
        if (!this.tail)
            return;
        const evictedKey = this.tail.key;
        const evictedSize = this.estimateSize(this.tail.value.data);
        this.removeNode(this.tail);
        this.cache.delete(evictedKey);
        this.currentMemory -= evictedSize;
        this.stats.evictions++;
        this.emit('cache:eviction', { key: evictedKey });
    }
    startCleanupTimer() {
        // Clean up expired entries every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired();
        }, 60000);
    }
    cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, node] of this.cache) {
            if (node.value.expiresAt < now) {
                this.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this.emit('cache:cleanup', { expired: cleaned });
        }
    }
}
/**
 * Multi-layer cache with L1 (memory) and L2 (storage) tiers
 */
export class TieredCacheManager extends EventEmitter {
    l1Cache;
    l2Loader = null;
    l2Writer = null;
    constructor(l1Config = {}, l2Options) {
        super();
        this.l1Cache = new CacheManager(l1Config);
        if (l2Options) {
            this.l2Loader = l2Options.loader;
            this.l2Writer = l2Options.writer ?? null;
        }
        // Forward L1 events
        this.l1Cache.on('cache:hit', (data) => this.emit('l1:hit', data));
        this.l1Cache.on('cache:miss', (data) => this.emit('l1:miss', data));
        this.l1Cache.on('cache:eviction', (data) => this.emit('l1:eviction', data));
    }
    /**
     * Get from tiered cache
     */
    async get(key) {
        // Try L1 first
        const l1Result = this.l1Cache.get(key);
        if (l1Result !== null) {
            return l1Result;
        }
        // Try L2 if available
        if (this.l2Loader) {
            const l2Result = await this.l2Loader(key);
            if (l2Result !== null) {
                // Promote to L1
                this.l1Cache.set(key, l2Result);
                this.emit('l2:hit', { key });
                return l2Result;
            }
            this.emit('l2:miss', { key });
        }
        return null;
    }
    /**
     * Set in tiered cache
     */
    async set(key, value, ttl) {
        // Write to L1
        this.l1Cache.set(key, value, ttl);
        // Write-through to L2 if configured
        if (this.l2Writer) {
            await this.l2Writer(key, value);
            this.emit('l2:write', { key });
        }
    }
    /**
     * Delete from tiered cache
     */
    delete(key) {
        return this.l1Cache.delete(key);
    }
    /**
     * Get L1 cache statistics
     */
    getStats() {
        return this.l1Cache.getStats();
    }
    /**
     * Clear L1 cache
     */
    clear() {
        this.l1Cache.clear();
    }
    /**
     * Shutdown tiered cache
     */
    shutdown() {
        this.l1Cache.shutdown();
    }
}
export default CacheManager;
//# sourceMappingURL=cache-manager.js.map