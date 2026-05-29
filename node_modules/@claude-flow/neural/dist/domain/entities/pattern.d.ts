/**
 * Pattern Entity - Domain Layer
 *
 * Represents a learned pattern for intelligent routing and optimization.
 *
 * @module v3/neural/domain/entities
 */
/**
 * Pattern type
 */
export type PatternType = 'task-routing' | 'error-recovery' | 'optimization' | 'learning';
/**
 * Pattern properties
 */
export interface PatternProps {
    id?: string;
    type: PatternType;
    name: string;
    description: string;
    condition: string;
    action: string;
    confidence: number;
    successCount?: number;
    failureCount?: number;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
    lastMatchedAt?: Date;
}
/**
 * Pattern Entity
 */
export declare class Pattern {
    private _id;
    private _type;
    private _name;
    private _description;
    private _condition;
    private _action;
    private _confidence;
    private _successCount;
    private _failureCount;
    private _metadata;
    private _createdAt;
    private _updatedAt;
    private _lastMatchedAt?;
    private constructor();
    static create(props: PatternProps): Pattern;
    static fromPersistence(props: PatternProps): Pattern;
    get id(): string;
    get type(): PatternType;
    get name(): string;
    get description(): string;
    get condition(): string;
    get action(): string;
    get confidence(): number;
    get successCount(): number;
    get failureCount(): number;
    get metadata(): Record<string, unknown>;
    get createdAt(): Date;
    get updatedAt(): Date;
    get lastMatchedAt(): Date | undefined;
    /**
     * Calculate success rate
     */
    get successRate(): number;
    /**
     * Record successful match
     */
    recordSuccess(): void;
    /**
     * Record failed match
     */
    recordFailure(): void;
    /**
     * Calculate confidence based on success rate
     */
    private calculateConfidence;
    /**
     * Check if pattern matches input
     */
    matches(input: string): boolean;
    /**
     * Check if pattern is reliable (high confidence, sufficient data)
     */
    isReliable(): boolean;
    toPersistence(): Record<string, unknown>;
}
//# sourceMappingURL=pattern.d.ts.map