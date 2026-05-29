/**
 * Event Store Persistence (ADR-007)
 *
 * Provides persistent storage for domain events using SQLite.
 * Supports event replay, snapshots, and projections.
 *
 * Key Features:
 * - Append-only event log
 * - Event versioning per aggregate
 * - Event filtering and queries
 * - Snapshot support for performance
 * - Event replay for projections
 * - Cross-platform SQLite (sql.js fallback)
 *
 * @module v3/shared/events/event-store
 */
import { EventEmitter } from 'node:events';
import { DomainEvent } from './domain-events.js';
export interface EventStoreConfig {
    /** Path to SQLite database file (:memory: for in-memory) */
    databasePath: string;
    /** Enable verbose logging */
    verbose: boolean;
    /** Auto-persist interval in milliseconds (0 = manual only) */
    autoPersistInterval: number;
    /** Maximum events before snapshot recommendation */
    snapshotThreshold: number;
    /** Path to sql.js WASM file (optional) */
    wasmPath?: string;
}
export interface EventFilter {
    /** Filter by aggregate IDs */
    aggregateIds?: string[];
    /** Filter by aggregate types */
    aggregateTypes?: Array<'agent' | 'task' | 'memory' | 'swarm'>;
    /** Filter by event types */
    eventTypes?: string[];
    /** Filter events after timestamp */
    afterTimestamp?: number;
    /** Filter events before timestamp */
    beforeTimestamp?: number;
    /** Filter by minimum version */
    fromVersion?: number;
    /** Limit number of results */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
}
export interface EventSnapshot {
    /** Aggregate ID */
    aggregateId: string;
    /** Aggregate type */
    aggregateType: 'agent' | 'task' | 'memory' | 'swarm';
    /** Version at snapshot */
    version: number;
    /** Snapshot state */
    state: Record<string, unknown>;
    /** Timestamp when snapshot was created */
    timestamp: number;
}
export interface EventStoreStats {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByAggregate: Record<string, number>;
    oldestEvent: number | null;
    newestEvent: number | null;
    snapshotCount: number;
}
export declare class EventStore extends EventEmitter {
    private config;
    private db;
    private initialized;
    private persistTimer;
    private SQL;
    private aggregateVersions;
    constructor(config?: Partial<EventStoreConfig>);
    /**
     * Initialize the event store
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the event store
     */
    shutdown(): Promise<void>;
    /**
     * Append a new event to the store
     */
    append(event: DomainEvent): Promise<void>;
    /**
     * Get events for a specific aggregate
     */
    getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
    /**
     * Get events by type
     */
    getEventsByType(type: string): Promise<DomainEvent[]>;
    /**
     * Query events with filters
     */
    query(filter: EventFilter): Promise<DomainEvent[]>;
    /**
     * Replay events from a specific version
     */
    replay(fromVersion?: number): AsyncIterable<DomainEvent>;
    /**
     * Save a snapshot for an aggregate
     */
    saveSnapshot(snapshot: EventSnapshot): Promise<void>;
    /**
     * Get snapshot for an aggregate
     */
    getSnapshot(aggregateId: string): Promise<EventSnapshot | null>;
    /**
     * Get event store statistics
     */
    getStats(): Promise<EventStoreStats>;
    /**
     * Persist to disk
     */
    persist(): Promise<void>;
    private createSchema;
    private loadAggregateVersions;
    private rowToEvent;
    private ensureInitialized;
}
//# sourceMappingURL=event-store.d.ts.map