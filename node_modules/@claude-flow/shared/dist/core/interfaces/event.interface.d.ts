/**
 * V3 Event Interfaces
 * Domain-Driven Design - Event Sourcing Pattern (ADR-007)
 */
/**
 * Event priority levels
 */
export type EventPriority = 'critical' | 'high' | 'normal' | 'low';
/**
 * Core event structure
 */
export interface IEvent<T = unknown> {
    readonly id: string;
    readonly type: string;
    readonly timestamp: Date;
    readonly source: string;
    payload: T;
    priority?: EventPriority;
    correlationId?: string;
    causationId?: string;
    metadata?: {
        version?: number;
        userId?: string;
        sessionId?: string;
        [key: string]: unknown;
    };
}
/**
 * Event creation parameters
 */
export interface IEventCreate<T = unknown> {
    type: string;
    payload: T;
    source?: string;
    priority?: EventPriority;
    correlationId?: string;
    causationId?: string;
    metadata?: IEvent['metadata'];
}
/**
 * Event handler function type
 */
export type IEventHandler<T = unknown> = (event: IEvent<T>) => void | Promise<void>;
/**
 * Event filter for subscriptions
 */
export interface IEventFilter {
    types?: string[];
    sources?: string[];
    priority?: EventPriority[];
    correlationId?: string;
}
/**
 * Event subscription handle
 */
export interface IEventSubscription {
    readonly id: string;
    readonly filter: IEventFilter;
    /**
     * Unsubscribe from events
     */
    unsubscribe(): void;
    /**
     * Pause subscription
     */
    pause(): void;
    /**
     * Resume subscription
     */
    resume(): void;
    /**
     * Check if subscription is active
     */
    isActive(): boolean;
}
/**
 * Event bus interface for pub/sub communication
 */
export interface IEventBus {
    /**
     * Emit an event to all subscribers
     */
    emit<T = unknown>(type: string, payload: T, options?: Partial<IEventCreate<T>>): void;
    /**
     * Emit an event and wait for all handlers
     */
    emitAsync<T = unknown>(type: string, payload: T, options?: Partial<IEventCreate<T>>): Promise<void>;
    /**
     * Subscribe to events matching a type pattern
     */
    on<T = unknown>(type: string, handler: IEventHandler<T>): IEventSubscription;
    /**
     * Subscribe to events with filter
     */
    subscribe<T = unknown>(filter: IEventFilter, handler: IEventHandler<T>): IEventSubscription;
    /**
     * Subscribe to a single event occurrence
     */
    once<T = unknown>(type: string, handler: IEventHandler<T>): IEventSubscription;
    /**
     * Remove a specific handler
     */
    off(type: string, handler: IEventHandler): void;
    /**
     * Remove all handlers for a type
     */
    removeAllListeners(type?: string): void;
    /**
     * Get count of listeners for a type
     */
    listenerCount(type: string): number;
    /**
     * Get all event types with active listeners
     */
    eventNames(): string[];
}
/**
 * System event types enumeration
 */
export declare const SystemEventTypes: {
    readonly SYSTEM_READY: "system:ready";
    readonly SYSTEM_SHUTDOWN: "system:shutdown";
    readonly SYSTEM_ERROR: "system:error";
    readonly SYSTEM_HEALTHCHECK: "system:healthcheck";
    readonly AGENT_SPAWNED: "agent:spawned";
    readonly AGENT_TERMINATED: "agent:terminated";
    readonly AGENT_ERROR: "agent:error";
    readonly AGENT_IDLE: "agent:idle";
    readonly AGENT_BUSY: "agent:busy";
    readonly AGENT_HEALTH_CHANGED: "agent:health:changed";
    readonly TASK_CREATED: "task:created";
    readonly TASK_ASSIGNED: "task:assigned";
    readonly TASK_STARTED: "task:started";
    readonly TASK_COMPLETED: "task:completed";
    readonly TASK_FAILED: "task:failed";
    readonly TASK_CANCELLED: "task:cancelled";
    readonly TASK_TIMEOUT: "task:timeout";
    readonly TASK_RETRY: "task:retry";
    readonly SESSION_CREATED: "session:created";
    readonly SESSION_RESTORED: "session:restored";
    readonly SESSION_TERMINATED: "session:terminated";
    readonly SESSION_PERSISTED: "session:persisted";
    readonly MEMORY_STORED: "memory:stored";
    readonly MEMORY_RETRIEVED: "memory:retrieved";
    readonly MEMORY_CLEARED: "memory:cleared";
    readonly COORDINATION_STARTED: "coordination:started";
    readonly COORDINATION_COMPLETED: "coordination:completed";
    readonly DEADLOCK_DETECTED: "coordination:deadlock";
    readonly METRICS_COLLECTED: "metrics:collected";
};
export type SystemEventType = typeof SystemEventTypes[keyof typeof SystemEventTypes];
/**
 * Event store interface for event sourcing
 */
export interface IEventStore {
    /**
     * Append an event to the store
     */
    append(event: IEvent): Promise<void>;
    /**
     * Get events by aggregate ID
     */
    getByAggregateId(aggregateId: string, fromVersion?: number): Promise<IEvent[]>;
    /**
     * Get events by type
     */
    getByType(type: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<IEvent[]>;
    /**
     * Get events in time range
     */
    getByTimeRange(start: Date, end: Date): Promise<IEvent[]>;
    /**
     * Get events by correlation ID
     */
    getByCorrelationId(correlationId: string): Promise<IEvent[]>;
    /**
     * Get all events (paginated)
     */
    getAll(options?: {
        limit?: number;
        offset?: number;
    }): Promise<IEvent[]>;
    /**
     * Get event count
     */
    count(filter?: IEventFilter): Promise<number>;
    /**
     * Clear old events
     */
    prune(olderThan: Date): Promise<number>;
}
/**
 * Event coordinator for routing and orchestration
 */
export interface IEventCoordinator {
    /**
     * Initialize the coordinator
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the coordinator
     */
    shutdown(): Promise<void>;
    /**
     * Route an event to appropriate handlers
     */
    route(event: IEvent): Promise<void>;
    /**
     * Register a handler for event routing
     */
    registerHandler(type: string, handler: IEventHandler): void;
    /**
     * Unregister a handler
     */
    unregisterHandler(type: string, handler: IEventHandler): void;
    /**
     * Get event bus instance
     */
    getEventBus(): IEventBus;
}
//# sourceMappingURL=event.interface.d.ts.map