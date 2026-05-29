/**
 * Memory Domain Layer - Public Exports
 *
 * Exports all domain entities, value objects, services, and interfaces.
 *
 * @module v3/memory/domain
 */
export { MemoryEntry, type MemoryType, type MemoryStatus, type MemoryEntryProps, } from './entities/memory-entry.js';
export { type IMemoryRepository, type MemoryQueryOptions, type VectorSearchOptions, type VectorSearchResult, type BulkOperationResult, type MemoryStatistics, } from './repositories/memory-repository.interface.js';
export { MemoryDomainService, type ConsolidationStrategy, type ConsolidationOptions, type ConsolidationResult, type DeduplicationResult, type NamespaceAnalysis, } from './services/memory-domain-service.js';
//# sourceMappingURL=index.d.ts.map