/**
 * Search Memory Query - Application Layer (CQRS)
 *
 * Query for searching memory entries.
 * Supports text search, vector search, and filtering.
 *
 * @module v3/memory/application/queries
 */
/**
 * Search Memory Query Handler
 */
export class SearchMemoryQueryHandler {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async execute(input) {
        const limit = input.limit ?? 10;
        const offset = input.offset ?? 0;
        // Vector search takes precedence
        if (input.vector) {
            return this.executeVectorSearch(input, limit, offset);
        }
        // Text search
        if (input.textQuery) {
            return this.executeTextSearch(input, limit, offset);
        }
        // Filter-based search
        return this.executeFilterSearch(input, limit, offset);
    }
    async executeVectorSearch(input, limit, offset) {
        const results = await this.repository.searchByVector({
            vector: input.vector,
            namespace: input.namespace,
            limit: limit + offset, // Get extra for pagination
            threshold: input.similarityThreshold ?? 0.5,
            type: input.type,
        });
        // Apply offset
        const paginatedResults = results.slice(offset, offset + limit);
        // Track access if requested
        if (input.trackAccess) {
            await this.trackEntryAccess(paginatedResults.map((r) => r.entry));
        }
        return {
            entries: paginatedResults.map((r) => r.entry),
            total: results.length,
            hasMore: results.length > offset + limit,
            searchType: 'vector',
            similarities: paginatedResults.map((r) => r.similarity),
        };
    }
    async executeTextSearch(input, limit, offset) {
        // Get all entries matching filters
        const options = {
            namespace: input.namespace,
            type: input.type,
            status: input.status ?? 'active',
            orderBy: input.orderBy ?? 'createdAt',
            orderDirection: input.orderDirection ?? 'desc',
        };
        const allEntries = await this.repository.findAll(options);
        // Filter by text query
        const query = input.textQuery.toLowerCase();
        const matchingEntries = allEntries.filter((entry) => {
            const valueStr = JSON.stringify(entry.value).toLowerCase();
            const metadataStr = JSON.stringify(entry.metadata).toLowerCase();
            return valueStr.includes(query) || metadataStr.includes(query);
        });
        // Paginate
        const paginatedEntries = matchingEntries.slice(offset, offset + limit);
        // Track access if requested
        if (input.trackAccess) {
            await this.trackEntryAccess(paginatedEntries);
        }
        return {
            entries: paginatedEntries,
            total: matchingEntries.length,
            hasMore: matchingEntries.length > offset + limit,
            searchType: 'text',
        };
    }
    async executeFilterSearch(input, limit, offset) {
        const options = {
            namespace: input.namespace,
            type: input.type,
            status: input.status ?? 'active',
            limit,
            offset,
            orderBy: input.orderBy ?? 'createdAt',
            orderDirection: input.orderDirection ?? 'desc',
        };
        const entries = await this.repository.findAll(options);
        const total = await this.repository.count({
            namespace: input.namespace,
            type: input.type,
            status: input.status ?? 'active',
        });
        // Track access if requested
        if (input.trackAccess) {
            await this.trackEntryAccess(entries);
        }
        return {
            entries,
            total,
            hasMore: total > offset + limit,
            searchType: 'filter',
        };
    }
    async trackEntryAccess(entries) {
        for (const entry of entries) {
            entry.recordAccess();
            await this.repository.save(entry);
        }
    }
}
/**
 * Get Memory By Key Query Handler
 */
export class GetMemoryByKeyQueryHandler {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async execute(input) {
        const entry = await this.repository.findByKey(input.namespace, input.key);
        if (!entry) {
            return { found: false };
        }
        if (!entry.isAccessible()) {
            return { found: false };
        }
        if (input.trackAccess) {
            entry.recordAccess();
            await this.repository.save(entry);
        }
        return {
            found: true,
            entry,
        };
    }
}
//# sourceMappingURL=search-memory.query.js.map