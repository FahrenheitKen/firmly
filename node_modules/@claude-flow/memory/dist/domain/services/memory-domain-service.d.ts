/**
 * Memory Domain Service - Domain Layer
 *
 * Contains domain logic that doesn't naturally fit within a single entity.
 * Coordinates between multiple memory entries and enforces domain rules.
 *
 * @module v3/memory/domain/services
 */
import { MemoryEntry, MemoryType } from '../entities/memory-entry.js';
import { IMemoryRepository, VectorSearchResult } from '../repositories/memory-repository.interface.js';
/**
 * Memory consolidation strategy
 */
export type ConsolidationStrategy = 'merge' | 'dedupe' | 'prune' | 'summarize';
/**
 * Memory consolidation options
 */
export interface ConsolidationOptions {
    strategy: ConsolidationStrategy;
    namespace?: string;
    threshold?: number;
    maxAge?: number;
    keepHot?: boolean;
}
/**
 * Consolidation result
 */
export interface ConsolidationResult {
    processed: number;
    consolidated: number;
    removed: number;
    newEntries: MemoryEntry[];
}
/**
 * Memory deduplication result
 */
export interface DeduplicationResult {
    duplicatesFound: number;
    duplicatesRemoved: number;
    groupsProcessed: number;
}
/**
 * Memory namespace statistics
 */
export interface NamespaceAnalysis {
    namespace: string;
    totalEntries: number;
    activeEntries: number;
    totalSize: number;
    averageAccessCount: number;
    oldestEntry: Date;
    newestEntry: Date;
    typeDistribution: Record<MemoryType, number>;
}
/**
 * Memory Domain Service
 *
 * Provides domain-level operations that span multiple entities.
 * Implements business rules for memory management.
 */
export declare class MemoryDomainService {
    private readonly repository;
    constructor(repository: IMemoryRepository);
    /**
     * Store a new memory with automatic type detection
     */
    storeWithTypeDetection(namespace: string, key: string, value: unknown, vector?: Float32Array): Promise<MemoryEntry>;
    /**
     * Retrieve and record access
     */
    retrieveWithAccessTracking(namespace: string, key: string): Promise<MemoryEntry | null>;
    /**
     * Search for similar memories and record access
     */
    searchSimilarWithTracking(vector: Float32Array, namespace?: string, limit?: number): Promise<VectorSearchResult[]>;
    /**
     * Consolidate memories based on strategy
     */
    consolidate(options: ConsolidationOptions): Promise<ConsolidationResult>;
    /**
     * Detect memory type based on value structure
     */
    private detectMemoryType;
    /**
     * Prune old, rarely accessed memories
     */
    private pruneOldMemories;
    /**
     * Find and remove duplicate memories
     */
    private deduplicateMemories;
    /**
     * Merge related memories into consolidated entries
     */
    private mergeRelatedMemories;
    /**
     * Merge multiple entries into one
     */
    private mergeEntries;
    /**
     * Analyze a namespace
     */
    analyzeNamespace(namespace: string): Promise<NamespaceAnalysis>;
}
//# sourceMappingURL=memory-domain-service.d.ts.map