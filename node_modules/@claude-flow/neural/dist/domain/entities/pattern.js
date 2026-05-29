/**
 * Pattern Entity - Domain Layer
 *
 * Represents a learned pattern for intelligent routing and optimization.
 *
 * @module v3/neural/domain/entities
 */
import { randomUUID } from 'crypto';
/**
 * Pattern Entity
 */
export class Pattern {
    _id;
    _type;
    _name;
    _description;
    _condition;
    _action;
    _confidence;
    _successCount;
    _failureCount;
    _metadata;
    _createdAt;
    _updatedAt;
    _lastMatchedAt;
    constructor(props) {
        const now = new Date();
        this._id = props.id ?? randomUUID();
        this._type = props.type;
        this._name = props.name;
        this._description = props.description;
        this._condition = props.condition;
        this._action = props.action;
        this._confidence = props.confidence;
        this._successCount = props.successCount ?? 0;
        this._failureCount = props.failureCount ?? 0;
        this._metadata = props.metadata ?? {};
        this._createdAt = props.createdAt ?? now;
        this._updatedAt = props.updatedAt ?? now;
        this._lastMatchedAt = props.lastMatchedAt;
    }
    static create(props) {
        return new Pattern(props);
    }
    static fromPersistence(props) {
        return new Pattern(props);
    }
    get id() { return this._id; }
    get type() { return this._type; }
    get name() { return this._name; }
    get description() { return this._description; }
    get condition() { return this._condition; }
    get action() { return this._action; }
    get confidence() { return this._confidence; }
    get successCount() { return this._successCount; }
    get failureCount() { return this._failureCount; }
    get metadata() { return { ...this._metadata }; }
    get createdAt() { return new Date(this._createdAt); }
    get updatedAt() { return new Date(this._updatedAt); }
    get lastMatchedAt() { return this._lastMatchedAt ? new Date(this._lastMatchedAt) : undefined; }
    /**
     * Calculate success rate
     */
    get successRate() {
        const total = this._successCount + this._failureCount;
        return total > 0 ? this._successCount / total : 0;
    }
    /**
     * Record successful match
     */
    recordSuccess() {
        this._successCount++;
        this._confidence = this.calculateConfidence();
        this._lastMatchedAt = new Date();
        this._updatedAt = new Date();
    }
    /**
     * Record failed match
     */
    recordFailure() {
        this._failureCount++;
        this._confidence = this.calculateConfidence();
        this._lastMatchedAt = new Date();
        this._updatedAt = new Date();
    }
    /**
     * Calculate confidence based on success rate
     */
    calculateConfidence() {
        const total = this._successCount + this._failureCount;
        if (total < 5)
            return this._confidence; // Not enough data
        const newConfidence = this.successRate;
        // Weighted average with existing confidence
        return this._confidence * 0.3 + newConfidence * 0.7;
    }
    /**
     * Check if pattern matches input
     */
    matches(input) {
        try {
            const regex = new RegExp(this._condition, 'i');
            return regex.test(input);
        }
        catch {
            return input.toLowerCase().includes(this._condition.toLowerCase());
        }
    }
    /**
     * Check if pattern is reliable (high confidence, sufficient data)
     */
    isReliable() {
        const total = this._successCount + this._failureCount;
        return total >= 10 && this._confidence >= 0.7;
    }
    toPersistence() {
        return {
            id: this._id,
            type: this._type,
            name: this._name,
            description: this._description,
            condition: this._condition,
            action: this._action,
            confidence: this._confidence,
            successCount: this._successCount,
            failureCount: this._failureCount,
            metadata: this._metadata,
            createdAt: this._createdAt.toISOString(),
            updatedAt: this._updatedAt.toISOString(),
            lastMatchedAt: this._lastMatchedAt?.toISOString(),
        };
    }
}
//# sourceMappingURL=pattern.js.map