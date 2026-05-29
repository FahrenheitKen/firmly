/**
 * Memory Entry Entity - Domain Layer
 *
 * Core domain entity representing a stored memory item.
 * Implements DDD principles with encapsulated business logic.
 *
 * @module v3/memory/domain/entities
 */
import { randomUUID } from 'crypto';
/**
 * Memory Entry - Aggregate Root
 *
 * Represents a single memory entry with business logic
 * for access tracking, expiration, and state management.
 */
export class MemoryEntry {
    _id;
    _namespace;
    _key;
    _value;
    _type;
    _vector;
    _metadata;
    _accessCount;
    _lastAccessedAt;
    _createdAt;
    _updatedAt;
    _status;
    _ttl;
    constructor(props) {
        const now = new Date();
        this._id = props.id ?? randomUUID();
        this._namespace = props.namespace;
        this._key = props.key;
        this._value = props.value;
        this._type = props.type;
        this._vector = props.vector;
        this._metadata = props.metadata ?? {};
        this._accessCount = props.accessCount ?? 0;
        this._lastAccessedAt = props.lastAccessedAt ?? now;
        this._createdAt = props.createdAt ?? now;
        this._updatedAt = props.updatedAt ?? now;
        this._status = props.status ?? 'active';
        this._ttl = props.ttl;
    }
    /**
     * Factory method - Create new memory entry
     */
    static create(props) {
        return new MemoryEntry(props);
    }
    /**
     * Factory method - Reconstruct from persistence
     */
    static fromPersistence(props) {
        return new MemoryEntry(props);
    }
    // Getters
    get id() {
        return this._id;
    }
    get namespace() {
        return this._namespace;
    }
    get key() {
        return this._key;
    }
    get value() {
        return this._value;
    }
    get type() {
        return this._type;
    }
    get vector() {
        return this._vector;
    }
    get metadata() {
        return { ...this._metadata };
    }
    get accessCount() {
        return this._accessCount;
    }
    get lastAccessedAt() {
        return new Date(this._lastAccessedAt);
    }
    get createdAt() {
        return new Date(this._createdAt);
    }
    get updatedAt() {
        return new Date(this._updatedAt);
    }
    get status() {
        return this._status;
    }
    get ttl() {
        return this._ttl;
    }
    get compositeKey() {
        return `${this._namespace}:${this._key}`;
    }
    // Business Logic Methods
    /**
     * Record an access to this memory entry
     */
    recordAccess() {
        this._accessCount++;
        this._lastAccessedAt = new Date();
    }
    /**
     * Update the value of this memory entry
     */
    updateValue(value) {
        this._value = value;
        this._updatedAt = new Date();
    }
    /**
     * Update the vector embedding
     */
    updateVector(vector) {
        this._vector = vector;
        this._updatedAt = new Date();
    }
    /**
     * Add or update metadata
     */
    setMetadata(key, value) {
        this._metadata[key] = value;
        this._updatedAt = new Date();
    }
    /**
     * Remove metadata key
     */
    removeMetadata(key) {
        delete this._metadata[key];
        this._updatedAt = new Date();
    }
    /**
     * Archive this memory entry
     */
    archive() {
        this._status = 'archived';
        this._updatedAt = new Date();
    }
    /**
     * Restore archived memory entry
     */
    restore() {
        if (this._status === 'archived') {
            this._status = 'active';
            this._updatedAt = new Date();
        }
    }
    /**
     * Mark as deleted (soft delete)
     */
    delete() {
        this._status = 'deleted';
        this._updatedAt = new Date();
    }
    /**
     * Check if memory has expired based on TTL
     */
    isExpired() {
        if (!this._ttl)
            return false;
        const expiresAt = this._createdAt.getTime() + this._ttl;
        return Date.now() > expiresAt;
    }
    /**
     * Check if memory is accessible (active and not expired)
     */
    isAccessible() {
        return this._status === 'active' && !this.isExpired();
    }
    /**
     * Calculate age in milliseconds
     */
    getAge() {
        return Date.now() - this._createdAt.getTime();
    }
    /**
     * Calculate time since last access in milliseconds
     */
    getTimeSinceLastAccess() {
        return Date.now() - this._lastAccessedAt.getTime();
    }
    /**
     * Check if memory is considered "hot" (frequently accessed)
     */
    isHot(threshold = 10) {
        return this._accessCount >= threshold;
    }
    /**
     * Check if memory is considered "cold" (not accessed recently)
     */
    isCold(milliseconds = 3600000) {
        return this.getTimeSinceLastAccess() > milliseconds;
    }
    /**
     * Convert to plain object for persistence
     */
    toPersistence() {
        return {
            id: this._id,
            namespace: this._namespace,
            key: this._key,
            value: this._value,
            type: this._type,
            vector: this._vector ? Array.from(this._vector) : undefined,
            metadata: this._metadata,
            accessCount: this._accessCount,
            lastAccessedAt: this._lastAccessedAt.toISOString(),
            createdAt: this._createdAt.toISOString(),
            updatedAt: this._updatedAt.toISOString(),
            status: this._status,
            ttl: this._ttl,
        };
    }
    /**
     * Convert to JSON-serializable object
     */
    toJSON() {
        return this.toPersistence();
    }
}
//# sourceMappingURL=memory-entry.js.map