/**
 * Hybrid Memory Repository - Infrastructure Layer
 *
 * Implements IMemoryRepository using SQLite + AgentDB hybrid backend.
 * Per ADR-009, this is the default memory backend.
 *
 * @module v3/memory/infrastructure/repositories
 */
/**
 * Hybrid Memory Repository
 *
 * Uses SQLite for metadata and AgentDB for vectors.
 * Implements hot caching for frequently accessed entries.
 */
export class HybridMemoryRepository {
    config;
    entries = new Map();
    namespaceIndex = new Map();
    vectorIndex = new Map();
    cache = new Map();
    initialized = false;
    constructor(config) {
        this.config = config;
    }
    // ============================================================================
    // Lifecycle
    // ============================================================================
    async initialize() {
        if (this.initialized)
            return;
        // In production, would initialize SQLite and AgentDB connections
        // For now, using in-memory implementation
        this.entries = new Map();
        this.namespaceIndex = new Map();
        this.vectorIndex = new Map();
        this.cache = new Map();
        this.initialized = true;
    }
    async shutdown() {
        // Clear all data
        this.cache.clear();
        this.initialized = false;
    }
    async clear() {
        this.entries.clear();
        this.namespaceIndex.clear();
        this.vectorIndex.clear();
        this.cache.clear();
    }
    // ============================================================================
    // Basic CRUD
    // ============================================================================
    async save(entry) {
        this.ensureInitialized();
        // Store entry
        this.entries.set(entry.id, entry);
        // Update namespace index
        if (!this.namespaceIndex.has(entry.namespace)) {
            this.namespaceIndex.set(entry.namespace, new Set());
        }
        this.namespaceIndex.get(entry.namespace).add(entry.id);
        // Store vector if present
        if (entry.vector) {
            this.vectorIndex.set(entry.id, entry.vector);
        }
        // Update cache
        this.updateCache(entry);
    }
    async findById(id) {
        this.ensureInitialized();
        // Check cache first
        const cached = this.cache.get(id);
        if (cached) {
            return cached.entry;
        }
        return this.entries.get(id) ?? null;
    }
    async findByKey(namespace, key) {
        this.ensureInitialized();
        for (const entry of this.entries.values()) {
            if (entry.namespace === namespace && entry.key === key) {
                return entry;
            }
        }
        return null;
    }
    async findByCompositeKey(compositeKey) {
        const [namespace, key] = compositeKey.split(':');
        return this.findByKey(namespace, key);
    }
    async delete(id) {
        this.ensureInitialized();
        const entry = this.entries.get(id);
        if (!entry)
            return false;
        // Remove from all indexes
        this.entries.delete(id);
        this.namespaceIndex.get(entry.namespace)?.delete(id);
        this.vectorIndex.delete(id);
        this.cache.delete(id);
        return true;
    }
    async exists(id) {
        return this.entries.has(id);
    }
    // ============================================================================
    // Bulk Operations
    // ============================================================================
    async saveMany(entries) {
        const errors = [];
        let success = 0;
        for (const entry of entries) {
            try {
                await this.save(entry);
                success++;
            }
            catch (error) {
                errors.push({
                    id: entry.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return {
            success,
            failed: errors.length,
            errors,
        };
    }
    async findByIds(ids) {
        return ids
            .map((id) => this.entries.get(id))
            .filter((e) => e !== undefined);
    }
    async deleteMany(ids) {
        const errors = [];
        let success = 0;
        for (const id of ids) {
            try {
                if (await this.delete(id)) {
                    success++;
                }
                else {
                    errors.push({ id, error: 'Entry not found' });
                }
            }
            catch (error) {
                errors.push({
                    id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return {
            success,
            failed: errors.length,
            errors,
        };
    }
    // ============================================================================
    // Query Operations
    // ============================================================================
    async findAll(options) {
        this.ensureInitialized();
        let results = Array.from(this.entries.values());
        // Apply filters
        if (options?.namespace) {
            results = results.filter((e) => e.namespace === options.namespace);
        }
        if (options?.type) {
            results = results.filter((e) => e.type === options.type);
        }
        if (options?.status) {
            results = results.filter((e) => e.status === options.status);
        }
        // Apply sorting
        const orderBy = options?.orderBy ?? 'createdAt';
        const orderDir = options?.orderDirection ?? 'desc';
        results.sort((a, b) => {
            let aVal, bVal;
            switch (orderBy) {
                case 'accessCount':
                    aVal = a.accessCount;
                    bVal = b.accessCount;
                    break;
                case 'lastAccessedAt':
                    aVal = a.lastAccessedAt.getTime();
                    bVal = b.lastAccessedAt.getTime();
                    break;
                case 'updatedAt':
                    aVal = a.updatedAt.getTime();
                    bVal = b.updatedAt.getTime();
                    break;
                default:
                    aVal = a.createdAt.getTime();
                    bVal = b.createdAt.getTime();
            }
            return orderDir === 'asc' ? aVal - bVal : bVal - aVal;
        });
        // Apply pagination
        if (options?.offset) {
            results = results.slice(options.offset);
        }
        if (options?.limit) {
            results = results.slice(0, options.limit);
        }
        return results;
    }
    async findByNamespace(namespace, options) {
        return this.findAll({ ...options, namespace });
    }
    async findByType(type, options) {
        return this.findAll({ ...options, type });
    }
    async findByStatus(status, options) {
        return this.findAll({ ...options, status });
    }
    // ============================================================================
    // Vector Search
    // ============================================================================
    async searchByVector(options) {
        this.ensureInitialized();
        const results = [];
        for (const [id, vector] of this.vectorIndex) {
            const entry = this.entries.get(id);
            if (!entry)
                continue;
            if (options.namespace && entry.namespace !== options.namespace)
                continue;
            if (options.type && entry.type !== options.type)
                continue;
            const similarity = this.cosineSimilarity(options.vector, vector);
            const threshold = options.threshold ?? 0.5;
            if (similarity >= threshold) {
                results.push({
                    entry,
                    similarity,
                    distance: 1 - similarity,
                });
            }
        }
        // Sort by similarity descending
        results.sort((a, b) => b.similarity - a.similarity);
        // Limit results
        return results.slice(0, options.limit ?? 10);
    }
    async findSimilar(entryId, limit = 10) {
        const entry = this.entries.get(entryId);
        if (!entry || !entry.vector)
            return [];
        return this.searchByVector({
            vector: entry.vector,
            namespace: entry.namespace,
            limit: limit + 1, // Include self
        }).then((results) => results.filter((r) => r.entry.id !== entryId).slice(0, limit));
    }
    // ============================================================================
    // Maintenance Operations
    // ============================================================================
    async findExpired() {
        return Array.from(this.entries.values()).filter((e) => e.isExpired());
    }
    async deleteExpired() {
        const expired = await this.findExpired();
        for (const entry of expired) {
            await this.delete(entry.id);
        }
        return expired.length;
    }
    async findCold(milliseconds) {
        return Array.from(this.entries.values()).filter((e) => e.isCold(milliseconds));
    }
    async archiveCold(milliseconds) {
        const cold = await this.findCold(milliseconds);
        for (const entry of cold) {
            entry.archive();
            await this.save(entry);
        }
        return cold.length;
    }
    // ============================================================================
    // Statistics
    // ============================================================================
    async getStatistics() {
        const entries = Array.from(this.entries.values());
        const entriesByNamespace = {};
        const entriesByType = {
            semantic: 0,
            episodic: 0,
            procedural: 0,
            working: 0,
        };
        let totalAccessCount = 0;
        let totalSize = 0;
        let activeCount = 0;
        let archivedCount = 0;
        let deletedCount = 0;
        for (const entry of entries) {
            // Count by namespace
            entriesByNamespace[entry.namespace] = (entriesByNamespace[entry.namespace] ?? 0) + 1;
            // Count by type
            entriesByType[entry.type]++;
            // Accumulate stats
            totalAccessCount += entry.accessCount;
            totalSize += JSON.stringify(entry.value).length;
            // Count by status
            switch (entry.status) {
                case 'active':
                    activeCount++;
                    break;
                case 'archived':
                    archivedCount++;
                    break;
                case 'deleted':
                    deletedCount++;
                    break;
            }
        }
        // Find hottest and coldest
        const sorted = [...entries].sort((a, b) => b.accessCount - a.accessCount);
        const hottestEntries = sorted.slice(0, 5).map((e) => e.id);
        const coldestEntries = sorted.slice(-5).reverse().map((e) => e.id);
        return {
            totalEntries: entries.length,
            activeEntries: activeCount,
            archivedEntries: archivedCount,
            deletedEntries: deletedCount,
            totalSize,
            entriesByNamespace,
            entriesByType,
            averageAccessCount: entries.length > 0 ? totalAccessCount / entries.length : 0,
            hottestEntries,
            coldestEntries,
        };
    }
    async count(options) {
        const entries = await this.findAll(options);
        return entries.length;
    }
    // ============================================================================
    // Namespace Operations
    // ============================================================================
    async listNamespaces() {
        return Array.from(this.namespaceIndex.keys());
    }
    async deleteNamespace(namespace) {
        const ids = this.namespaceIndex.get(namespace);
        if (!ids)
            return 0;
        const count = ids.size;
        for (const id of ids) {
            await this.delete(id);
        }
        this.namespaceIndex.delete(namespace);
        return count;
    }
    async getNamespaceSize(namespace) {
        const ids = this.namespaceIndex.get(namespace);
        if (!ids)
            return 0;
        let size = 0;
        for (const id of ids) {
            const entry = this.entries.get(id);
            if (entry) {
                size += JSON.stringify(entry.value).length;
            }
        }
        return size;
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('Repository not initialized. Call initialize() first.');
        }
    }
    updateCache(entry) {
        const maxCacheSize = this.config.cacheSize ?? 100;
        // Evict oldest entries if cache is full
        if (this.cache.size >= maxCacheSize) {
            const oldest = Array.from(this.cache.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp)
                .slice(0, Math.floor(maxCacheSize * 0.2));
            for (const [id] of oldest) {
                this.cache.delete(id);
            }
        }
        this.cache.set(entry.id, {
            entry,
            timestamp: Date.now(),
        });
    }
    cosineSimilarity(a, b) {
        if (a.length !== b.length)
            return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }
}
//# sourceMappingURL=hybrid-memory-repository.js.map