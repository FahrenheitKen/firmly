/**
 * V3 Query Builder
 *
 * Fluent API for building memory queries with filter chaining,
 * sorting options, and pagination support.
 *
 * @module v3/memory/query-builder
 */
import { MemoryQuery, MemoryType, AccessLevel, DistanceMetric } from './types.js';
/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';
/**
 * Sort field options
 */
export type SortField = 'createdAt' | 'updatedAt' | 'lastAccessedAt' | 'accessCount' | 'key' | 'score';
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
export declare class QueryBuilder {
    private state;
    constructor();
    /**
     * Create a semantic (vector similarity) query
     */
    semantic(content: string): this;
    /**
     * Create a semantic query with pre-computed embedding
     */
    semanticWithEmbedding(embedding: Float32Array): this;
    /**
     * Create an exact key match query
     */
    exact(key: string): this;
    /**
     * Create a key prefix match query
     */
    prefix(keyPrefix: string): this;
    /**
     * Create a tag-based query
     */
    byTags(tags: string[]): this;
    /**
     * Create a hybrid query (semantic + filters)
     */
    hybrid(content: string): this;
    /**
     * Filter by namespace
     */
    inNamespace(namespace: string): this;
    /**
     * Add tag filter (entries must have all specified tags)
     */
    withTags(tags: string[]): this;
    /**
     * Add a single tag filter
     */
    withTag(tag: string): this;
    /**
     * Filter by memory type
     */
    ofType(type: MemoryType): this;
    /**
     * Filter by access level
     */
    withAccessLevel(level: AccessLevel): this;
    /**
     * Filter by owner
     */
    ownedBy(ownerId: string): this;
    /**
     * Filter by metadata field
     */
    whereMetadata(key: string, value: unknown): this;
    /**
     * Filter by creation date range
     */
    createdBetween(after: Date | number, before?: Date | number): this;
    /**
     * Filter entries created after a date
     */
    createdAfter(date: Date | number): this;
    /**
     * Filter entries created before a date
     */
    createdBefore(date: Date | number): this;
    /**
     * Filter by update date range
     */
    updatedBetween(after: Date | number, before?: Date | number): this;
    /**
     * Filter entries updated in the last N milliseconds
     */
    updatedWithin(milliseconds: number): this;
    /**
     * Set maximum number of results
     */
    limit(count: number): this;
    /**
     * Set pagination offset
     */
    offset(count: number): this;
    /**
     * Set pagination with page number and size
     */
    page(pageNumber: number, pageSize: number): this;
    /**
     * Set minimum similarity threshold for semantic search
     */
    threshold(minScore: number): this;
    /**
     * Include expired entries in results
     */
    includeExpired(include?: boolean): this;
    /**
     * Set distance metric for semantic search
     */
    withMetric(metric: DistanceMetric): this;
    /**
     * Sort results by field
     */
    sortBy(field: SortField, direction?: SortDirection): this;
    /**
     * Sort by creation date (newest first)
     */
    newestFirst(): this;
    /**
     * Sort by creation date (oldest first)
     */
    oldestFirst(): this;
    /**
     * Sort by relevance score (highest first)
     */
    mostRelevant(): this;
    /**
     * Sort by access count (most accessed first)
     */
    mostAccessed(): this;
    /**
     * Sort by last accessed time (most recent first)
     */
    recentlyAccessed(): this;
    /**
     * Build the final query object
     */
    build(): MemoryQuery;
    /**
     * Clone this builder
     */
    clone(): QueryBuilder;
    /**
     * Reset the builder to initial state
     */
    reset(): this;
}
/**
 * Convenience function to create a new query builder
 */
export declare function query(): QueryBuilder;
/**
 * Predefined query templates for common use cases
 */
export declare const QueryTemplates: {
    /**
     * Find recent entries in a namespace
     */
    recentInNamespace(namespace: string, limit?: number): MemoryQuery;
    /**
     * Find entries by exact key
     */
    byKey(namespace: string, key: string): MemoryQuery;
    /**
     * Semantic search with threshold
     */
    semanticSearch(content: string, namespace?: string, threshold?: number, limit?: number): MemoryQuery;
    /**
     * Find entries with specific tags
     */
    withTags(tags: string[], namespace?: string, limit?: number): MemoryQuery;
    /**
     * Find entries owned by a specific agent
     */
    ownedBy(ownerId: string, namespace?: string, limit?: number): MemoryQuery;
    /**
     * Find episodic memories within a time range
     */
    episodicInRange(after: Date | number, before: Date | number, limit?: number): MemoryQuery;
    /**
     * Find hot entries (frequently accessed)
     */
    hotEntries(namespace?: string, limit?: number): MemoryQuery;
    /**
     * Find stale entries (not accessed recently)
     */
    staleEntries(staleThresholdMs: number, namespace?: string, limit?: number): MemoryQuery;
};
export default QueryBuilder;
//# sourceMappingURL=query-builder.d.ts.map