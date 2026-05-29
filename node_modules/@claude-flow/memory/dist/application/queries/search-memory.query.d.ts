/**
 * Search Memory Query - Application Layer (CQRS)
 *
 * Query for searching memory entries.
 * Supports text search, vector search, and filtering.
 *
 * @module v3/memory/application/queries
 */
import { MemoryEntry, MemoryType, MemoryStatus } from '../../domain/entities/memory-entry.js';
import { IMemoryRepository } from '../../domain/repositories/memory-repository.interface.js';
/**
 * Search Memory Query Input
 */
export interface SearchMemoryInput {
    vector?: Float32Array;
    similarityThreshold?: number;
    namespace?: string;
    type?: MemoryType;
    status?: MemoryStatus;
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt';
    orderDirection?: 'asc' | 'desc';
    textQuery?: string;
    trackAccess?: boolean;
}
/**
 * Search Memory Query Result
 */
export interface SearchMemoryResult {
    entries: MemoryEntry[];
    total: number;
    hasMore: boolean;
    searchType: 'vector' | 'filter' | 'text';
    similarities?: number[];
}
/**
 * Search Memory Query Handler
 */
export declare class SearchMemoryQueryHandler {
    private readonly repository;
    constructor(repository: IMemoryRepository);
    execute(input: SearchMemoryInput): Promise<SearchMemoryResult>;
    private executeVectorSearch;
    private executeTextSearch;
    private executeFilterSearch;
    private trackEntryAccess;
}
/**
 * Get Memory By Key Query Input
 */
export interface GetMemoryByKeyInput {
    namespace: string;
    key: string;
    trackAccess?: boolean;
}
/**
 * Get Memory By Key Query Result
 */
export interface GetMemoryByKeyResult {
    found: boolean;
    entry?: MemoryEntry;
}
/**
 * Get Memory By Key Query Handler
 */
export declare class GetMemoryByKeyQueryHandler {
    private readonly repository;
    constructor(repository: IMemoryRepository);
    execute(input: GetMemoryByKeyInput): Promise<GetMemoryByKeyResult>;
}
//# sourceMappingURL=search-memory.query.d.ts.map