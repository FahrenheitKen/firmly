/**
 * V3 Unified Memory Types
 *
 * Type definitions for the unified memory system based on AgentDB with HNSW indexing.
 * Supports 150x-12,500x faster vector search compared to brute-force approaches.
 *
 * @module v3/memory/types
 */
/**
 * Generates a unique memory ID
 */
export function generateMemoryId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `mem_${timestamp}_${random}`;
}
/**
 * Creates a default memory entry
 */
export function createDefaultEntry(input) {
    const now = Date.now();
    return {
        id: generateMemoryId(),
        key: input.key,
        content: input.content,
        type: input.type || 'semantic',
        namespace: input.namespace || 'default',
        tags: input.tags || [],
        metadata: input.metadata || {},
        ownerId: input.ownerId,
        accessLevel: input.accessLevel || 'private',
        createdAt: now,
        updatedAt: now,
        expiresAt: input.expiresAt,
        version: 1,
        references: input.references || [],
        accessCount: 0,
        lastAccessedAt: now,
    };
}
/**
 * Performance targets for V3 memory system
 */
export const PERFORMANCE_TARGETS = {
    /** Maximum vector search time for 100k vectors */
    MAX_SEARCH_TIME_100K: 1, // ms
    /** Maximum write time per entry */
    MAX_WRITE_TIME: 5, // ms
    /** Maximum batch insert time per entry */
    MAX_BATCH_INSERT_TIME: 1, // ms
    /** Target memory reduction from legacy systems */
    MEMORY_REDUCTION_TARGET: 0.5, // 50%
    /** Minimum search improvement over brute force */
    MIN_SEARCH_IMPROVEMENT: 150, // 150x
    /** Maximum search improvement over brute force */
    MAX_SEARCH_IMPROVEMENT: 12500, // 12,500x
};
//# sourceMappingURL=types.js.map