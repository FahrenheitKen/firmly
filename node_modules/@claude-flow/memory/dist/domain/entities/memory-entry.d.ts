/**
 * Memory Entry Entity - Domain Layer
 *
 * Core domain entity representing a stored memory item.
 * Implements DDD principles with encapsulated business logic.
 *
 * @module v3/memory/domain/entities
 */
/**
 * Memory entry types
 */
export type MemoryType = 'semantic' | 'episodic' | 'procedural' | 'working';
/**
 * Memory entry status
 */
export type MemoryStatus = 'active' | 'archived' | 'deleted';
/**
 * Memory entry properties
 */
export interface MemoryEntryProps {
    id?: string;
    namespace: string;
    key: string;
    value: unknown;
    type: MemoryType;
    vector?: Float32Array;
    metadata?: Record<string, unknown>;
    accessCount?: number;
    lastAccessedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    status?: MemoryStatus;
    ttl?: number;
}
/**
 * Memory Entry - Aggregate Root
 *
 * Represents a single memory entry with business logic
 * for access tracking, expiration, and state management.
 */
export declare class MemoryEntry {
    private _id;
    private _namespace;
    private _key;
    private _value;
    private _type;
    private _vector?;
    private _metadata;
    private _accessCount;
    private _lastAccessedAt;
    private _createdAt;
    private _updatedAt;
    private _status;
    private _ttl?;
    private constructor();
    /**
     * Factory method - Create new memory entry
     */
    static create(props: MemoryEntryProps): MemoryEntry;
    /**
     * Factory method - Reconstruct from persistence
     */
    static fromPersistence(props: MemoryEntryProps): MemoryEntry;
    get id(): string;
    get namespace(): string;
    get key(): string;
    get value(): unknown;
    get type(): MemoryType;
    get vector(): Float32Array | undefined;
    get metadata(): Record<string, unknown>;
    get accessCount(): number;
    get lastAccessedAt(): Date;
    get createdAt(): Date;
    get updatedAt(): Date;
    get status(): MemoryStatus;
    get ttl(): number | undefined;
    get compositeKey(): string;
    /**
     * Record an access to this memory entry
     */
    recordAccess(): void;
    /**
     * Update the value of this memory entry
     */
    updateValue(value: unknown): void;
    /**
     * Update the vector embedding
     */
    updateVector(vector: Float32Array): void;
    /**
     * Add or update metadata
     */
    setMetadata(key: string, value: unknown): void;
    /**
     * Remove metadata key
     */
    removeMetadata(key: string): void;
    /**
     * Archive this memory entry
     */
    archive(): void;
    /**
     * Restore archived memory entry
     */
    restore(): void;
    /**
     * Mark as deleted (soft delete)
     */
    delete(): void;
    /**
     * Check if memory has expired based on TTL
     */
    isExpired(): boolean;
    /**
     * Check if memory is accessible (active and not expired)
     */
    isAccessible(): boolean;
    /**
     * Calculate age in milliseconds
     */
    getAge(): number;
    /**
     * Calculate time since last access in milliseconds
     */
    getTimeSinceLastAccess(): number;
    /**
     * Check if memory is considered "hot" (frequently accessed)
     */
    isHot(threshold?: number): boolean;
    /**
     * Check if memory is considered "cold" (not accessed recently)
     */
    isCold(milliseconds?: number): boolean;
    /**
     * Convert to plain object for persistence
     */
    toPersistence(): Record<string, unknown>;
    /**
     * Convert to JSON-serializable object
     */
    toJSON(): Record<string, unknown>;
}
//# sourceMappingURL=memory-entry.d.ts.map