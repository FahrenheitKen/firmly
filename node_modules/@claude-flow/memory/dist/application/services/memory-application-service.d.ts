/**
 * Memory Application Service - Application Layer
 *
 * Orchestrates use cases and coordinates between domain and infrastructure.
 * Provides a simplified interface for external consumers.
 *
 * @module v3/memory/application/services
 */
import { MemoryEntry, MemoryType } from '../../domain/entities/memory-entry.js';
import { IMemoryRepository, VectorSearchResult, MemoryStatistics } from '../../domain/repositories/memory-repository.interface.js';
import { ConsolidationOptions, ConsolidationResult } from '../../domain/services/memory-domain-service.js';
import { StoreMemoryInput } from '../commands/store-memory.command.js';
import { SearchMemoryInput } from '../queries/search-memory.query.js';
/**
 * Memory Application Service
 *
 * Main entry point for memory operations.
 * Coordinates commands and queries with domain services.
 */
export declare class MemoryApplicationService {
    private readonly repository;
    private readonly domainService;
    private readonly storeHandler;
    private readonly deleteHandler;
    private readonly bulkDeleteHandler;
    private readonly searchHandler;
    private readonly getByKeyHandler;
    constructor(repository: IMemoryRepository);
    /**
     * Store a memory entry
     */
    store(input: StoreMemoryInput): Promise<MemoryEntry>;
    /**
     * Store multiple memory entries
     */
    storeMany(inputs: StoreMemoryInput[]): Promise<MemoryEntry[]>;
    /**
     * Get a memory entry by namespace and key
     */
    get(namespace: string, key: string): Promise<MemoryEntry | null>;
    /**
     * Get a memory entry by ID
     */
    getById(id: string): Promise<MemoryEntry | null>;
    /**
     * Search memory entries
     */
    search(input: SearchMemoryInput): Promise<{
        entries: MemoryEntry[];
        total: number;
        hasMore: boolean;
    }>;
    /**
     * Search by vector similarity
     */
    searchByVector(vector: Float32Array, options?: {
        namespace?: string;
        limit?: number;
        threshold?: number;
    }): Promise<VectorSearchResult[]>;
    /**
     * Get all entries in a namespace
     */
    getNamespace(namespace: string): Promise<MemoryEntry[]>;
    /**
     * List all namespaces
     */
    listNamespaces(): Promise<string[]>;
    /**
     * Delete a memory entry by namespace and key
     */
    delete(namespace: string, key: string, hardDelete?: boolean): Promise<boolean>;
    /**
     * Delete a memory entry by ID
     */
    deleteById(id: string, hardDelete?: boolean): Promise<boolean>;
    /**
     * Delete all entries in a namespace
     */
    deleteNamespace(namespace: string, hardDelete?: boolean): Promise<number>;
    /**
     * Clear all memory entries
     */
    clear(): Promise<void>;
    /**
     * Consolidate memories using specified strategy
     */
    consolidate(options: ConsolidationOptions): Promise<ConsolidationResult>;
    /**
     * Clean up expired memories
     */
    cleanupExpired(): Promise<number>;
    /**
     * Archive cold (rarely accessed) memories
     */
    archiveCold(milliseconds?: number): Promise<number>;
    /**
     * Get memory statistics
     */
    getStatistics(): Promise<MemoryStatistics>;
    /**
     * Count entries matching criteria
     */
    count(options?: {
        namespace?: string;
        type?: MemoryType;
    }): Promise<number>;
    /**
     * Analyze a namespace
     */
    analyzeNamespace(namespace: string): Promise<import("../../domain/index.js").NamespaceAnalysis>;
    /**
     * Initialize the memory service
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the memory service
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=memory-application-service.d.ts.map