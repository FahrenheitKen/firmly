/**
 * Memory Application Service - Application Layer
 *
 * Orchestrates use cases and coordinates between domain and infrastructure.
 * Provides a simplified interface for external consumers.
 *
 * @module v3/memory/application/services
 */
import { MemoryDomainService } from '../../domain/services/memory-domain-service.js';
import { StoreMemoryCommandHandler } from '../commands/store-memory.command.js';
import { DeleteMemoryCommandHandler, BulkDeleteMemoryCommandHandler } from '../commands/delete-memory.command.js';
import { SearchMemoryQueryHandler, GetMemoryByKeyQueryHandler } from '../queries/search-memory.query.js';
/**
 * Memory Application Service
 *
 * Main entry point for memory operations.
 * Coordinates commands and queries with domain services.
 */
export class MemoryApplicationService {
    repository;
    domainService;
    storeHandler;
    deleteHandler;
    bulkDeleteHandler;
    searchHandler;
    getByKeyHandler;
    constructor(repository) {
        this.repository = repository;
        this.domainService = new MemoryDomainService(repository);
        this.storeHandler = new StoreMemoryCommandHandler(repository, this.domainService);
        this.deleteHandler = new DeleteMemoryCommandHandler(repository);
        this.bulkDeleteHandler = new BulkDeleteMemoryCommandHandler(repository);
        this.searchHandler = new SearchMemoryQueryHandler(repository);
        this.getByKeyHandler = new GetMemoryByKeyQueryHandler(repository);
    }
    // ============================================================================
    // Store Operations (Commands)
    // ============================================================================
    /**
     * Store a memory entry
     */
    async store(input) {
        const result = await this.storeHandler.execute(input);
        return result.entry;
    }
    /**
     * Store multiple memory entries
     */
    async storeMany(inputs) {
        const results = await Promise.all(inputs.map((input) => this.storeHandler.execute(input)));
        return results.map((r) => r.entry);
    }
    // ============================================================================
    // Retrieve Operations (Queries)
    // ============================================================================
    /**
     * Get a memory entry by namespace and key
     */
    async get(namespace, key) {
        const result = await this.getByKeyHandler.execute({ namespace, key, trackAccess: true });
        return result.entry ?? null;
    }
    /**
     * Get a memory entry by ID
     */
    async getById(id) {
        return this.repository.findById(id);
    }
    /**
     * Search memory entries
     */
    async search(input) {
        const result = await this.searchHandler.execute(input);
        return {
            entries: result.entries,
            total: result.total,
            hasMore: result.hasMore,
        };
    }
    /**
     * Search by vector similarity
     */
    async searchByVector(vector, options) {
        return this.domainService.searchSimilarWithTracking(vector, options?.namespace, options?.limit ?? 10);
    }
    /**
     * Get all entries in a namespace
     */
    async getNamespace(namespace) {
        return this.repository.findByNamespace(namespace, { status: 'active' });
    }
    /**
     * List all namespaces
     */
    async listNamespaces() {
        return this.repository.listNamespaces();
    }
    // ============================================================================
    // Delete Operations (Commands)
    // ============================================================================
    /**
     * Delete a memory entry by namespace and key
     */
    async delete(namespace, key, hardDelete = false) {
        const result = await this.deleteHandler.execute({ namespace, key, hardDelete });
        return result.deleted;
    }
    /**
     * Delete a memory entry by ID
     */
    async deleteById(id, hardDelete = false) {
        const result = await this.deleteHandler.execute({ id, hardDelete });
        return result.deleted;
    }
    /**
     * Delete all entries in a namespace
     */
    async deleteNamespace(namespace, hardDelete = false) {
        const entries = await this.repository.findByNamespace(namespace);
        const result = await this.bulkDeleteHandler.execute({
            ids: entries.map((e) => e.id),
            hardDelete,
        });
        return result.deletedCount;
    }
    /**
     * Clear all memory entries
     */
    async clear() {
        await this.repository.clear();
    }
    // ============================================================================
    // Maintenance Operations
    // ============================================================================
    /**
     * Consolidate memories using specified strategy
     */
    async consolidate(options) {
        return this.domainService.consolidate(options);
    }
    /**
     * Clean up expired memories
     */
    async cleanupExpired() {
        return this.repository.deleteExpired();
    }
    /**
     * Archive cold (rarely accessed) memories
     */
    async archiveCold(milliseconds = 86400000) {
        return this.repository.archiveCold(milliseconds);
    }
    // ============================================================================
    // Statistics
    // ============================================================================
    /**
     * Get memory statistics
     */
    async getStatistics() {
        return this.repository.getStatistics();
    }
    /**
     * Count entries matching criteria
     */
    async count(options) {
        return this.repository.count(options);
    }
    /**
     * Analyze a namespace
     */
    async analyzeNamespace(namespace) {
        return this.domainService.analyzeNamespace(namespace);
    }
    // ============================================================================
    // Lifecycle
    // ============================================================================
    /**
     * Initialize the memory service
     */
    async initialize() {
        await this.repository.initialize();
    }
    /**
     * Shutdown the memory service
     */
    async shutdown() {
        await this.repository.shutdown();
    }
}
//# sourceMappingURL=memory-application-service.js.map