/**
 * V3 Query Builder
 *
 * Fluent API for building memory queries with filter chaining,
 * sorting options, and pagination support.
 *
 * @module v3/memory/query-builder
 */
/**
 * Fluent query builder for constructing memory queries
 *
 * @example
 * ```typescript
 * const query = new QueryBuilder()
 *   .semantic('user authentication patterns')
 *   .inNamespace('security')
 *   .withTags(['auth', 'patterns'])
 *   .ofType('semantic')
 *   .limit(10)
 *   .threshold(0.8)
 *   .build();
 * ```
 */
export class QueryBuilder {
    state;
    constructor() {
        this.state = {
            type: 'hybrid',
            tags: [],
            metadata: {},
            limit: 10,
            offset: 0,
            includeExpired: false,
            sortDirection: 'desc',
        };
    }
    /**
     * Create a semantic (vector similarity) query
     */
    semantic(content) {
        this.state.type = 'semantic';
        this.state.content = content;
        return this;
    }
    /**
     * Create a semantic query with pre-computed embedding
     */
    semanticWithEmbedding(embedding) {
        this.state.type = 'semantic';
        this.state.embedding = embedding;
        return this;
    }
    /**
     * Create an exact key match query
     */
    exact(key) {
        this.state.type = 'exact';
        this.state.key = key;
        return this;
    }
    /**
     * Create a key prefix match query
     */
    prefix(keyPrefix) {
        this.state.type = 'prefix';
        this.state.keyPrefix = keyPrefix;
        return this;
    }
    /**
     * Create a tag-based query
     */
    byTags(tags) {
        this.state.type = 'tag';
        this.state.tags = tags;
        return this;
    }
    /**
     * Create a hybrid query (semantic + filters)
     */
    hybrid(content) {
        this.state.type = 'hybrid';
        this.state.content = content;
        return this;
    }
    /**
     * Filter by namespace
     */
    inNamespace(namespace) {
        this.state.namespace = namespace;
        return this;
    }
    /**
     * Add tag filter (entries must have all specified tags)
     */
    withTags(tags) {
        this.state.tags = [...this.state.tags, ...tags];
        return this;
    }
    /**
     * Add a single tag filter
     */
    withTag(tag) {
        this.state.tags.push(tag);
        return this;
    }
    /**
     * Filter by memory type
     */
    ofType(type) {
        this.state.memoryType = type;
        return this;
    }
    /**
     * Filter by access level
     */
    withAccessLevel(level) {
        this.state.accessLevel = level;
        return this;
    }
    /**
     * Filter by owner
     */
    ownedBy(ownerId) {
        this.state.ownerId = ownerId;
        return this;
    }
    /**
     * Filter by metadata field
     */
    whereMetadata(key, value) {
        this.state.metadata[key] = value;
        return this;
    }
    /**
     * Filter by creation date range
     */
    createdBetween(after, before) {
        this.state.createdAfter = after instanceof Date ? after.getTime() : after;
        if (before !== undefined) {
            this.state.createdBefore = before instanceof Date ? before.getTime() : before;
        }
        return this;
    }
    /**
     * Filter entries created after a date
     */
    createdAfter(date) {
        this.state.createdAfter = date instanceof Date ? date.getTime() : date;
        return this;
    }
    /**
     * Filter entries created before a date
     */
    createdBefore(date) {
        this.state.createdBefore = date instanceof Date ? date.getTime() : date;
        return this;
    }
    /**
     * Filter by update date range
     */
    updatedBetween(after, before) {
        this.state.updatedAfter = after instanceof Date ? after.getTime() : after;
        if (before !== undefined) {
            this.state.updatedBefore = before instanceof Date ? before.getTime() : before;
        }
        return this;
    }
    /**
     * Filter entries updated in the last N milliseconds
     */
    updatedWithin(milliseconds) {
        this.state.updatedAfter = Date.now() - milliseconds;
        return this;
    }
    /**
     * Set maximum number of results
     */
    limit(count) {
        this.state.limit = Math.max(1, count);
        return this;
    }
    /**
     * Set pagination offset
     */
    offset(count) {
        this.state.offset = Math.max(0, count);
        return this;
    }
    /**
     * Set pagination with page number and size
     */
    page(pageNumber, pageSize) {
        this.state.limit = Math.max(1, pageSize);
        this.state.offset = Math.max(0, (pageNumber - 1) * pageSize);
        return this;
    }
    /**
     * Set minimum similarity threshold for semantic search
     */
    threshold(minScore) {
        this.state.threshold = Math.max(0, Math.min(1, minScore));
        return this;
    }
    /**
     * Include expired entries in results
     */
    includeExpired(include = true) {
        this.state.includeExpired = include;
        return this;
    }
    /**
     * Set distance metric for semantic search
     */
    withMetric(metric) {
        this.state.distanceMetric = metric;
        return this;
    }
    /**
     * Sort results by field
     */
    sortBy(field, direction = 'desc') {
        this.state.sortField = field;
        this.state.sortDirection = direction;
        return this;
    }
    /**
     * Sort by creation date (newest first)
     */
    newestFirst() {
        return this.sortBy('createdAt', 'desc');
    }
    /**
     * Sort by creation date (oldest first)
     */
    oldestFirst() {
        return this.sortBy('createdAt', 'asc');
    }
    /**
     * Sort by relevance score (highest first)
     */
    mostRelevant() {
        return this.sortBy('score', 'desc');
    }
    /**
     * Sort by access count (most accessed first)
     */
    mostAccessed() {
        return this.sortBy('accessCount', 'desc');
    }
    /**
     * Sort by last accessed time (most recent first)
     */
    recentlyAccessed() {
        return this.sortBy('lastAccessedAt', 'desc');
    }
    /**
     * Build the final query object
     */
    build() {
        const query = {
            type: this.state.type,
            limit: this.state.limit,
        };
        // Add optional fields
        if (this.state.content)
            query.content = this.state.content;
        if (this.state.embedding)
            query.embedding = this.state.embedding;
        if (this.state.key)
            query.key = this.state.key;
        if (this.state.keyPrefix)
            query.keyPrefix = this.state.keyPrefix;
        if (this.state.namespace)
            query.namespace = this.state.namespace;
        if (this.state.tags.length > 0)
            query.tags = this.state.tags;
        if (this.state.memoryType)
            query.memoryType = this.state.memoryType;
        if (this.state.accessLevel)
            query.accessLevel = this.state.accessLevel;
        if (this.state.ownerId)
            query.ownerId = this.state.ownerId;
        if (Object.keys(this.state.metadata).length > 0) {
            query.metadata = this.state.metadata;
        }
        if (this.state.createdAfter)
            query.createdAfter = this.state.createdAfter;
        if (this.state.createdBefore)
            query.createdBefore = this.state.createdBefore;
        if (this.state.updatedAfter)
            query.updatedAfter = this.state.updatedAfter;
        if (this.state.updatedBefore)
            query.updatedBefore = this.state.updatedBefore;
        if (this.state.offset > 0)
            query.offset = this.state.offset;
        if (this.state.threshold !== undefined)
            query.threshold = this.state.threshold;
        if (this.state.includeExpired)
            query.includeExpired = this.state.includeExpired;
        if (this.state.distanceMetric)
            query.distanceMetric = this.state.distanceMetric;
        return query;
    }
    /**
     * Clone this builder
     */
    clone() {
        const cloned = new QueryBuilder();
        cloned.state = {
            ...this.state,
            tags: [...this.state.tags],
            metadata: { ...this.state.metadata },
        };
        return cloned;
    }
    /**
     * Reset the builder to initial state
     */
    reset() {
        this.state = {
            type: 'hybrid',
            tags: [],
            metadata: {},
            limit: 10,
            offset: 0,
            includeExpired: false,
            sortDirection: 'desc',
        };
        return this;
    }
}
/**
 * Convenience function to create a new query builder
 */
export function query() {
    return new QueryBuilder();
}
/**
 * Predefined query templates for common use cases
 */
export const QueryTemplates = {
    /**
     * Find recent entries in a namespace
     */
    recentInNamespace(namespace, limit = 10) {
        return query()
            .inNamespace(namespace)
            .newestFirst()
            .limit(limit)
            .build();
    },
    /**
     * Find entries by exact key
     */
    byKey(namespace, key) {
        return query()
            .exact(key)
            .inNamespace(namespace)
            .limit(1)
            .build();
    },
    /**
     * Semantic search with threshold
     */
    semanticSearch(content, namespace, threshold = 0.7, limit = 10) {
        const builder = query()
            .semantic(content)
            .threshold(threshold)
            .limit(limit);
        if (namespace) {
            builder.inNamespace(namespace);
        }
        return builder.build();
    },
    /**
     * Find entries with specific tags
     */
    withTags(tags, namespace, limit = 10) {
        const builder = query()
            .byTags(tags)
            .limit(limit);
        if (namespace) {
            builder.inNamespace(namespace);
        }
        return builder.build();
    },
    /**
     * Find entries owned by a specific agent
     */
    ownedBy(ownerId, namespace, limit = 10) {
        const builder = query()
            .ownedBy(ownerId)
            .newestFirst()
            .limit(limit);
        if (namespace) {
            builder.inNamespace(namespace);
        }
        return builder.build();
    },
    /**
     * Find episodic memories within a time range
     */
    episodicInRange(after, before, limit = 100) {
        return query()
            .ofType('episodic')
            .createdBetween(after, before)
            .oldestFirst()
            .limit(limit)
            .build();
    },
    /**
     * Find hot entries (frequently accessed)
     */
    hotEntries(namespace, limit = 10) {
        const builder = query()
            .mostAccessed()
            .limit(limit);
        if (namespace) {
            builder.inNamespace(namespace);
        }
        return builder.build();
    },
    /**
     * Find stale entries (not accessed recently)
     */
    staleEntries(staleThresholdMs, namespace, limit = 100) {
        const builder = query()
            .updatedBetween(0, Date.now() - staleThresholdMs)
            .sortBy('lastAccessedAt', 'asc')
            .limit(limit);
        if (namespace) {
            builder.inNamespace(namespace);
        }
        return builder.build();
    },
};
export default QueryBuilder;
//# sourceMappingURL=query-builder.js.map