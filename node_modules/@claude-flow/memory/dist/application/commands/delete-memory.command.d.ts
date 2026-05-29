/**
 * Delete Memory Command - Application Layer (CQRS)
 *
 * Command for deleting memory entries.
 * Supports soft delete and hard delete.
 *
 * @module v3/memory/application/commands
 */
import { IMemoryRepository } from '../../domain/repositories/memory-repository.interface.js';
/**
 * Delete Memory Command Input
 */
export interface DeleteMemoryInput {
    id?: string;
    namespace?: string;
    key?: string;
    hardDelete?: boolean;
}
/**
 * Delete Memory Command Result
 */
export interface DeleteMemoryResult {
    success: boolean;
    deleted: boolean;
    entryId?: string;
    wasHardDelete: boolean;
}
/**
 * Delete Memory Command Handler
 */
export declare class DeleteMemoryCommandHandler {
    private readonly repository;
    constructor(repository: IMemoryRepository);
    execute(input: DeleteMemoryInput): Promise<DeleteMemoryResult>;
}
/**
 * Bulk Delete Command Input
 */
export interface BulkDeleteMemoryInput {
    ids?: string[];
    namespace?: string;
    olderThan?: Date;
    hardDelete?: boolean;
}
/**
 * Bulk Delete Command Result
 */
export interface BulkDeleteMemoryResult {
    success: boolean;
    deletedCount: number;
    failedCount: number;
    errors: Array<{
        id: string;
        error: string;
    }>;
}
/**
 * Bulk Delete Memory Command Handler
 */
export declare class BulkDeleteMemoryCommandHandler {
    private readonly repository;
    constructor(repository: IMemoryRepository);
    execute(input: BulkDeleteMemoryInput): Promise<BulkDeleteMemoryResult>;
}
//# sourceMappingURL=delete-memory.command.d.ts.map