/**
 * Store Memory Command - Application Layer (CQRS)
 *
 * Command for storing a new memory entry.
 * Implements CQRS pattern per ADR-002.
 *
 * @module v3/memory/application/commands
 */
import { MemoryEntry } from '../../domain/entities/memory-entry.js';
/**
 * Store Memory Command Handler
 *
 * Handles the command to store a memory entry.
 * Coordinates between domain services and repository.
 */
export class StoreMemoryCommandHandler {
    repository;
    domainService;
    constructor(repository, domainService) {
        this.repository = repository;
        this.domainService = domainService;
    }
    /**
     * Execute the store memory command
     */
    async execute(input) {
        // Check if entry already exists
        const existing = await this.repository.findByKey(input.namespace, input.key);
        const isUpdate = existing !== null;
        let entry;
        if (existing) {
            // Update existing entry
            existing.updateValue(input.value);
            if (input.vector) {
                existing.updateVector(input.vector);
            }
            if (input.metadata) {
                for (const [key, value] of Object.entries(input.metadata)) {
                    existing.setMetadata(key, value);
                }
            }
            await this.repository.save(existing);
            entry = existing;
        }
        else {
            // Create new entry
            if (input.type) {
                entry = MemoryEntry.create({
                    namespace: input.namespace,
                    key: input.key,
                    value: input.value,
                    type: input.type,
                    vector: input.vector,
                    metadata: input.metadata,
                    ttl: input.ttl,
                });
                await this.repository.save(entry);
            }
            else {
                // Use domain service for type detection
                entry = await this.domainService.storeWithTypeDetection(input.namespace, input.key, input.value, input.vector);
            }
        }
        return {
            success: true,
            entryId: entry.id,
            entry,
            isUpdate,
        };
    }
}
//# sourceMappingURL=store-memory.command.js.map