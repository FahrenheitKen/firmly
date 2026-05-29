/**
 * Hybrid Memory Repository - Infrastructure Layer
 *
 * Implements IMemoryRepository using SQLite + AgentDB hybrid backend.
 * Per ADR-009, this is the default memory backend.
 *
 * @module v3/memory/infrastructure/repositories
 */
import { MemoryEntry, MemoryType, MemoryStatus } from '../../domain/entities/memory-entry.js';
import { IMemoryRepository, MemoryQueryOptions, VectorSearchOptions, VectorSearchResult, BulkOperationResult, MemoryStatistics } from '../../domain/repositories/memory-repository.interface.js';
/**
 * Repository configuration
 */
export interface HybridRepositoryConfig {
    sqlitePath: string;
    agentDbPath?: string;
    enableVectorSearch?: boolean;
    cacheSize?: number;
    verbose?: boolean;
}
/**
 * Hybrid Memory Repository
 *
 * Uses SQLite for metadata and AgentDB for vectors.
 * Implements hot caching for frequently accessed entries.
 */
export declare class HybridMemoryRepository implements IMemoryRepository {
    private readonly config;
    private entries;
    private namespaceIndex;
    private vectorIndex;
    private cache;
    private initialized;
    constructor(config: HybridRepositoryConfig);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    clear(): Promise<void>;
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
    private ensureInitialized;
    private updateCache;
    private cosineSimilarity;
}
//# sourceMappingURL=hybrid-memory-repository.d.ts.map