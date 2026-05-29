/**
 * V3 Memory Migration Utility
 *
 * Migrates data from legacy memory systems (SQLite, Markdown, JSON, etc.)
 * to the unified AgentDB-backed memory system with HNSW indexing.
 *
 * @module v3/memory/migration
 */
import { EventEmitter } from 'node:events';
import { MigrationConfig, MigrationProgress, MigrationResult, MigrationSource, EmbeddingGenerator } from './types.js';
import { AgentDBAdapter } from './agentdb-adapter.js';
/**
 * Memory Migration Manager
 *
 * Handles migration from:
 * - SQLite backends (.db files)
 * - Markdown backends (.md files)
 * - JSON memory stores (.json files)
 * - MemoryManager instances
 * - SwarmMemory instances
 * - DistributedMemory instances
 */
export declare class MemoryMigrator extends EventEmitter {
    private config;
    private target;
    private embeddingGenerator?;
    private progress;
    constructor(target: AgentDBAdapter, config: Partial<MigrationConfig>, embeddingGenerator?: EmbeddingGenerator);
    /**
     * Run the migration
     */
    migrate(): Promise<MigrationResult>;
    /**
     * Get current migration progress
     */
    getProgress(): MigrationProgress;
    private loadFromSource;
    private loadFromSQLite;
    private loadFromMarkdown;
    private loadFromJSON;
    private loadFromMemoryManager;
    private loadFromSwarmMemory;
    private loadFromDistributedMemory;
    private processBatch;
    private transformEntry;
    private initializeProgress;
    private validateEntry;
    private addError;
    private parseTimestamp;
    private isValidMemoryType;
    private estimateTimeRemaining;
    private generateSummary;
    private walkDirectory;
    private parseMarkdownEntry;
}
/**
 * Convenience function to create a migrator
 */
export declare function createMigrator(target: AgentDBAdapter, source: MigrationSource, sourcePath: string, options?: Partial<MigrationConfig>, embeddingGenerator?: EmbeddingGenerator): MemoryMigrator;
/**
 * Migrate from multiple sources
 */
export declare function migrateMultipleSources(target: AgentDBAdapter, sources: Array<{
    source: MigrationSource;
    path: string;
}>, options?: Partial<MigrationConfig>, embeddingGenerator?: EmbeddingGenerator): Promise<MigrationResult[]>;
export default MemoryMigrator;
//# sourceMappingURL=migration.d.ts.map