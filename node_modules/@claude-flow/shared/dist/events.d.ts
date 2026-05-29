/**
 * V3 Event Bus System
 * Event-driven communication for the 15-agent swarm
 *
 * Based on ADR-007 (Event Sourcing for State Changes)
 */
import { EventType, EventHandler, SwarmEvent, AgentId } from './types.js';
export interface IEventBus {
    subscribe<T>(eventType: EventType, handler: EventHandler<T>): () => void;
    subscribeAll(handler: EventHandler): () => void;
    emit<T>(event: SwarmEvent<T>): Promise<void>;
    emitSync<T>(event: SwarmEvent<T>): void;
    getHistory(filter?: EventFilter): SwarmEvent[];
    clear(): void;
}
export interface EventFilter {
    types?: EventType[];
    sources?: (AgentId | 'swarm')[];
    since?: number;
    until?: number;
    limit?: number;
}
export interface IEventStore {
    append(event: SwarmEvent): Promise<void>;
    getEvents(aggregateId: string, fromVersion?: number): Promise<SwarmEvent[]>;
    getAllEvents(filter?: EventFilter): Promise<SwarmEvent[]>;
    getSnapshot(aggregateId: string): Promise<EventStoreSnapshot | null>;
    saveSnapshot(snapshot: EventStoreSnapshot): Promise<void>;
}
export interface EventStoreSnapshot {
    aggregateId: string;
    version: number;
    state: unknown;
    timestamp: number;
}
export declare class EventBus implements IEventBus {
    private handlers;
    private history;
    private maxHistorySize;
    constructor(options?: {
        maxHistorySize?: number;
    });
    subscribe<T>(eventType: EventType, handler: EventHandler<T>): () => void;
    subscribeAll(handler: EventHandler): () => void;
    emit<T>(event: SwarmEvent<T>): Promise<void>;
    emitSync<T>(event: SwarmEvent<T>): void;
    getHistory(filter?: EventFilter): SwarmEvent[];
    clear(): void;
    private addToHistory;
    private safeExecute;
}
export declare class InMemoryEventStore implements IEventStore {
    private events;
    private allEvents;
    private snapshots;
    append(event: SwarmEvent): Promise<void>;
    getEvents(aggregateId: string, fromVersion?: number): Promise<SwarmEvent[]>;
    getAllEvents(filter?: EventFilter): Promise<SwarmEvent[]>;
    getSnapshot(aggregateId: string): Promise<EventStoreSnapshot | null>;
    saveSnapshot(snapshot: EventStoreSnapshot): Promise<void>;
    private extractAggregateId;
}
export declare function createEvent<T>(type: EventType, source: AgentId | 'swarm', payload: T): SwarmEvent<T>;
export declare function agentSpawnedEvent(agentId: AgentId, role: string): SwarmEvent;
export declare function agentStatusChangedEvent(agentId: AgentId, previousStatus: string, newStatus: string): SwarmEvent;
export declare function agentTaskAssignedEvent(agentId: AgentId, taskId: string): SwarmEvent;
export declare function agentTaskCompletedEvent(agentId: AgentId, taskId: string, result: unknown): SwarmEvent;
export declare function agentErrorEvent(agentId: AgentId, error: Error): SwarmEvent;
export declare function taskCreatedEvent(taskId: string, type: string, title: string): SwarmEvent;
export declare function taskQueuedEvent(taskId: string, priority: string): SwarmEvent;
export declare function taskAssignedEvent(taskId: string, agentId: AgentId): SwarmEvent;
export declare function taskStartedEvent(taskId: string, agentId: AgentId): SwarmEvent;
export declare function taskCompletedEvent(taskId: string, result: unknown): SwarmEvent;
export declare function taskFailedEvent(taskId: string, error: Error): SwarmEvent;
export declare function taskBlockedEvent(taskId: string, blockedBy: string[]): SwarmEvent;
export declare function swarmInitializedEvent(config: unknown): SwarmEvent;
export declare function swarmPhaseChangedEvent(previousPhase: string, newPhase: string): SwarmEvent;
export declare function swarmMilestoneReachedEvent(milestoneId: string, name: string): SwarmEvent;
export declare function swarmErrorEvent(error: Error): SwarmEvent;
//# sourceMappingURL=events.d.ts.map