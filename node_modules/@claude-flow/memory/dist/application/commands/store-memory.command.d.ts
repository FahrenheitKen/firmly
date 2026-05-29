/**
 * Store Memory Command - Application Layer (CQRS)
 *
 * Command for storing a new memory entry.
 * Implements CQRS pattern per ADR-002.
 *
 * @module v3/memory/application/commands
 */
import { MemoryEntry, MemoryType } from '../../domain/entities/memory-entry.js';
import { IMemoryRepository } from '../../domain/repositories/memory-repository.interface.js';
import { MemoryDomainService } from '../../domain/services/memory-domain-service.js';
/**
 * Store Memory Command Input
 */
export interface StoreMemoryInput {
    namespace: string;
    key: string;
    value: unknown;
    type?: MemoryType;
    vector?: Float32Array;
    metadata?: Record<string, unknown>;
    ttl?: number;
}
/**
 * Store Memory Command Result
 */
export interface StoreMemoryResult {
    success: boolean;
    entryId: string;
    entry: MemoryEntry;
    isUpdate: boolean;
}
/**
 * Store Memory Command Handler
 *
 * Handles the command to store a memory entry.
 * Coordinates between domain services and repository.
 */
export declare class StoreMemoryCommandHandler {
    private readonly repository;
    private readonly domainService;
    constructor(repository: IMemoryRepository, domainService: MemoryDomainService);
    /**
     * Execute the store memory command
     */
    execute(input: StoreMemoryInput): Promise<StoreMemoryResult>;
}
//# sourceMappingURL=store-memory.command.d.ts.map