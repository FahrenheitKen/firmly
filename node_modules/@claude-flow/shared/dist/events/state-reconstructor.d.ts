/**
 * State Reconstructor - ADR-007 Implementation
 *
 * Reconstructs aggregate state from event streams.
 * Implements event sourcing patterns for V3.
 *
 * @module v3/shared/events/state-reconstructor
 */
import { EventStore } from './event-store.js';
import type { DomainEvent } from './domain-events.js';
/**
 * Aggregate root interface
 */
export interface AggregateRoot {
    id: string;
    version: number;
    apply(event: DomainEvent): void;
    getState(): Record<string, unknown>;
}
/**
 * Reconstructor options
 */
export interface ReconstructorOptions {
    useSnapshots: boolean;
    snapshotInterval: number;
    maxEventsToReplay: number;
}
/**
 * State Reconstructor
 *
 * Reconstructs aggregate state from event history.
 * Supports snapshots for performance optimization.
 */
export declare class StateReconstructor {
    private readonly eventStore;
    private readonly options;
    constructor(eventStore: EventStore, options?: Partial<ReconstructorOptions>);
    /**
     * Reconstruct aggregate state from events
     */
    reconstruct<T extends AggregateRoot>(aggregateId: string, factory: (id: string) => T): Promise<T>;
    /**
     * Reconstruct state at a specific point in time
     */
    reconstructAtTime<T extends AggregateRoot>(aggregateId: string, factory: (id: string) => T, timestamp: Date): Promise<T>;
    /**
     * Reconstruct state at a specific version
     */
    reconstructAtVersion<T extends AggregateRoot>(aggregateId: string, factory: (id: string) => T, targetVersion: number): Promise<T>;
    /**
     * Apply snapshot to aggregate
     */
    private applySnapshot;
    /**
     * Create snapshot for aggregate
     */
    private createSnapshot;
    /**
     * Get aggregate type from instance
     */
    private getAggregateType;
}
/**
 * Agent Aggregate - Example implementation
 */
export declare class AgentAggregate implements AggregateRoot {
    id: string;
    version: number;
    private state;
    constructor(id: string);
    apply(event: DomainEvent): void;
    getState(): Record<string, unknown>;
    restoreFromSnapshot(snapshotState: unknown): void;
    get name(): string;
    get role(): string;
    get status(): string;
    get currentTask(): string | null;
    get completedTasks(): string[];
    get capabilities(): string[];
}
/**
 * Task Aggregate - Example implementation
 */
export declare class TaskAggregate implements AggregateRoot {
    id: string;
    version: number;
    private state;
    constructor(id: string);
    apply(event: DomainEvent): void;
    getState(): Record<string, unknown>;
    restoreFromSnapshot(snapshotState: unknown): void;
    get title(): string;
    get status(): string;
    get assignedAgent(): string | null;
    get result(): unknown;
}
/**
 * Factory function
 */
export declare function createStateReconstructor(eventStore: EventStore, options?: Partial<ReconstructorOptions>): StateReconstructor;
//# sourceMappingURL=state-reconstructor.d.ts.map