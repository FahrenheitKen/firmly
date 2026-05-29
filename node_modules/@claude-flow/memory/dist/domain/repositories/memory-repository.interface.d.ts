/**
 * Memory Repository Interface - Domain Layer
 *
 * Defines the contract for memory persistence.
 * Following DDD, the interface belongs to the domain layer
 * while implementations belong to infrastructure.
 *
 * @module v3/memory/domain/repositories
 */
import { MemoryEntry, MemoryType, MemoryStatus } from '../entities/memory-entry.js';
/**
 * Query options for memory retrieval
 */
export interface MemoryQueryOptions {
    namespace?: string;
    type?: MemoryType;
    status?: MemoryStatus;
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt';
    orderDirection?: 'asc' | 'desc';
}
/**
 * Vector search options
 */
export interface VectorSearchOptions {
    vector: Float32Array;
    namespace?: string;
    limit?: number;
    threshold?: number;
    type?: MemoryType;
}
/**
 * Vector search result
 */
export interface VectorSearchResult {
    entry: MemoryEntry;
    similarity: number;
    distance: number;
}
/**
 * Bulk operation result
 */
export interface BulkOperationResult {
    success: number;
    failed: number;
    errors: Array<{
        id: string;
        error: string;
    }>;
}
/**
 * Memory statistics
 */
export interface MemoryStatistics {
    totalEntries: number;
    activeEntries: number;
    archivedEntries: number;
    deletedEntries: number;
    totalSize: number;
    entriesByNamespace: Record<string, number>;
    entriesByType: Record<MemoryType, number>;
    averageAccessCount: number;
    hottestEntries: string[];
    coldestEntries: string[];
}
/**
 * Memory Repository Interface
 *
 * Defines all operations for memory persistence.
 * Implementations can use SQLite, AgentDB, or hybrid backends.
 */
export interface IMemoryRepository {
    save(entry: MemoryEntry): Promise<void>;
    findById(id: string): Promise<MemoryEntry | null>;
    findByKey(namespace: string, key: string): Promise<MemoryEntry | null>;
    findByCompositeKey(compositeKey: string): Promise<MemoryEntry | null>;
    delete(id: string): Promise<boolean>;
    exists(id: string): Promise<boolean>;
    saveMany(entries: MemoryEntry[]): Promise<BulkOperationResult>;
    findByIds(ids: string[]): Promise<MemoryEntry[]>;
    deleteMany(ids: string[]): Promise<BulkOperationResult>;
    findAll(options?: MemoryQueryOptions): Promise<MemoryEntry[]>;
    findByNamespace(namespace: string, options?: Omit<MemoryQueryOptions, 'namespace'>): Promise<MemoryEntry[]>;
    findByType(type: MemoryType, options?: Omit<MemoryQueryOptions, 'type'>): Promise<MemoryEntry[]>;
    findByStatus(status: MemoryStatus, options?: Omit<MemoryQueryOptions, 'status'>): Promise<MemoryEntry[]>;
    searchByVector(options: VectorSearchOptions): Promise<VectorSearchResult[]>;
    findSimilar(entryId: string, limit?: number): Promise<VectorSearchResult[]>;
    findExpired(): Promise<MemoryEntry[]>;
    deleteExpired(): Promise<number>;
    findCold(milliseconds: number): Promise<MemoryEntry[]>;
    archiveCold(milliseconds: number): Promise<number>;
    getStatistics(): Promise<MemoryStatistics>;
    count(options?: MemoryQueryOptions): Promise<number>;
    listNamespaces(): Promise<string[]>;
    deleteNamespace(namespace: string): Promise<number>;
    getNamespaceSize(namespace: string): Promise<number>;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=memory-repository.interface.d.ts.map