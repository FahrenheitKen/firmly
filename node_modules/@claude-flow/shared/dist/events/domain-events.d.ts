/**
 * Domain Events for Event Sourcing (ADR-007)
 *
 * Defines all domain events for the V3 system:
 * - Agent lifecycle events (spawned, started, stopped, failed)
 * - Task execution events (created, started, completed, failed)
 * - Memory operations events (stored, retrieved, deleted)
 * - Swarm coordination events (initialized, scaled, terminated)
 *
 * @module v3/shared/events/domain-events
 */
import { AgentId, TaskId } from '../types.js';
export interface DomainEvent {
    /** Unique event identifier */
    id: string;
    /** Event type discriminator */
    type: string;
    /** Aggregate ID (entity the event belongs to) */
    aggregateId: string;
    /** Aggregate type (agent, task, memory, swarm) */
    aggregateType: 'agent' | 'task' | 'memory' | 'swarm';
    /** Event version for ordering */
    version: number;
    /** Timestamp when event occurred */
    timestamp: number;
    /** Event source (agent or swarm system) */
    source: AgentId | 'swarm';
    /** Event payload data */
    payload: Record<string, unknown>;
    /** Optional metadata */
    metadata?: Record<string, unknown>;
    /** Optional causation ID (event that caused this event) */
    causationId?: string;
    /** Optional correlation ID (groups related events) */
    correlationId?: string;
}
export interface AgentSpawnedEvent extends DomainEvent {
    type: 'agent:spawned';
    aggregateType: 'agent';
    payload: {
        agentId: AgentId;
        role: string;
        domain: string;
        capabilities: string[];
    };
}
export interface AgentStartedEvent extends DomainEvent {
    type: 'agent:started';
    aggregateType: 'agent';
    payload: {
        agentId: AgentId;
        startedAt: number;
    };
}
export interface AgentStoppedEvent extends DomainEvent {
    type: 'agent:stopped';
    aggregateType: 'agent';
    payload: {
        agentId: AgentId;
        reason: string;
        stoppedAt: number;
    };
}
export interface AgentFailedEvent extends DomainEvent {
    type: 'agent:failed';
    aggregateType: 'agent';
    payload: {
        agentId: AgentId;
        error: string;
        stack?: string;
        failedAt: number;
    };
}
export interface AgentStatusChangedEvent extends DomainEvent {
    type: 'agent:status-changed';
    aggregateType: 'agent';
    payload: {
        agentId: AgentId;
        previousStatus: string;
        newStatus: string;
    };
}
export interface AgentTaskAssignedEvent extends DomainEvent {
    type: 'agent:task-assigned';
    aggregateType: 'agent';
    payload: {
        agentId: AgentId;
        taskId: TaskId;
        assignedAt: number;
    };
}
export interface AgentTaskCompletedEvent extends DomainEvent {
    type: 'agent:task-completed';
    aggregateType: 'agent';
    payload: {
        agentId: AgentId;
        taskId: TaskId;
        result: unknown;
        completedAt: number;
        duration: number;
    };
}
export interface TaskCreatedEvent extends DomainEvent {
    type: 'task:created';
    aggregateType: 'task';
    payload: {
        taskId: TaskId;
        taskType: string;
        title: string;
        description: string;
        priority: string;
        dependencies: TaskId[];
        createdAt: number;
    };
}
export interface TaskStartedEvent extends DomainEvent {
    type: 'task:started';
    aggregateType: 'task';
    payload: {
        taskId: TaskId;
        agentId: AgentId;
        startedAt: number;
    };
}
export interface TaskCompletedEvent extends DomainEvent {
    type: 'task:completed';
    aggregateType: 'task';
    payload: {
        taskId: TaskId;
        result: unknown;
        completedAt: number;
        duration: number;
    };
}
export interface TaskFailedEvent extends DomainEvent {
    type: 'task:failed';
    aggregateType: 'task';
    payload: {
        taskId: TaskId;
        error: string;
        stack?: string;
        failedAt: number;
        retryCount: number;
    };
}
export interface TaskBlockedEvent extends DomainEvent {
    type: 'task:blocked';
    aggregateType: 'task';
    payload: {
        taskId: TaskId;
        blockedBy: TaskId[];
        blockedAt: number;
    };
}
export interface TaskQueuedEvent extends DomainEvent {
    type: 'task:queued';
    aggregateType: 'task';
    payload: {
        taskId: TaskId;
        priority: string;
        queuedAt: number;
    };
}
export interface MemoryStoredEvent extends DomainEvent {
    type: 'memory:stored';
    aggregateType: 'memory';
    payload: {
        memoryId: string;
        namespace: string;
        key: string;
        memoryType: string;
        size: number;
        storedAt: number;
    };
}
export interface MemoryRetrievedEvent extends DomainEvent {
    type: 'memory:retrieved';
    aggregateType: 'memory';
    payload: {
        memoryId: string;
        namespace: string;
        key: string;
        retrievedAt: number;
        accessCount: number;
    };
}
export interface MemoryDeletedEvent extends DomainEvent {
    type: 'memory:deleted';
    aggregateType: 'memory';
    payload: {
        memoryId: string;
        namespace: string;
        key: string;
        deletedAt: number;
    };
}
export interface MemoryExpiredEvent extends DomainEvent {
    type: 'memory:expired';
    aggregateType: 'memory';
    payload: {
        memoryId: string;
        namespace: string;
        key: string;
        expiredAt: number;
        expiresAt: number;
    };
}
export interface SwarmInitializedEvent extends DomainEvent {
    type: 'swarm:initialized';
    aggregateType: 'swarm';
    payload: {
        topology: string;
        maxAgents: number;
        config: Record<string, unknown>;
        initializedAt: number;
    };
}
export interface SwarmScaledEvent extends DomainEvent {
    type: 'swarm:scaled';
    aggregateType: 'swarm';
    payload: {
        previousAgentCount: number;
        newAgentCount: number;
        scaledAt: number;
        reason: string;
    };
}
export interface SwarmTerminatedEvent extends DomainEvent {
    type: 'swarm:terminated';
    aggregateType: 'swarm';
    payload: {
        reason: string;
        terminatedAt: number;
        metrics: Record<string, unknown>;
    };
}
export interface SwarmPhaseChangedEvent extends DomainEvent {
    type: 'swarm:phase-changed';
    aggregateType: 'swarm';
    payload: {
        previousPhase: string;
        newPhase: string;
        changedAt: number;
    };
}
export interface SwarmMilestoneReachedEvent extends DomainEvent {
    type: 'swarm:milestone-reached';
    aggregateType: 'swarm';
    payload: {
        milestoneId: string;
        name: string;
        reachedAt: number;
    };
}
export interface SwarmErrorEvent extends DomainEvent {
    type: 'swarm:error';
    aggregateType: 'swarm';
    payload: {
        error: string;
        stack?: string;
        context: Record<string, unknown>;
        errorAt: number;
    };
}
export type AllDomainEvents = AgentSpawnedEvent | AgentStartedEvent | AgentStoppedEvent | AgentFailedEvent | AgentStatusChangedEvent | AgentTaskAssignedEvent | AgentTaskCompletedEvent | TaskCreatedEvent | TaskStartedEvent | TaskCompletedEvent | TaskFailedEvent | TaskBlockedEvent | TaskQueuedEvent | MemoryStoredEvent | MemoryRetrievedEvent | MemoryDeletedEvent | MemoryExpiredEvent | SwarmInitializedEvent | SwarmScaledEvent | SwarmTerminatedEvent | SwarmPhaseChangedEvent | SwarmMilestoneReachedEvent | SwarmErrorEvent;
export declare function createAgentSpawnedEvent(agentId: AgentId, role: string, domain: string, capabilities: string[]): AgentSpawnedEvent;
export declare function createAgentStartedEvent(agentId: AgentId): AgentStartedEvent;
export declare function createAgentStoppedEvent(agentId: AgentId, reason: string): AgentStoppedEvent;
export declare function createAgentFailedEvent(agentId: AgentId, error: Error): AgentFailedEvent;
export declare function createAgentTaskAssignedEvent(agentId: AgentId, taskId: TaskId, assignedAt?: number): AgentTaskAssignedEvent;
export declare function createAgentTaskCompletedEvent(agentId: AgentId, taskId: TaskId, result: unknown, completedAt: number, duration: number): AgentTaskCompletedEvent;
export declare function createTaskCreatedEvent(taskId: TaskId, taskType: string, title: string, description: string, priority: string, dependencies: TaskId[]): TaskCreatedEvent;
export declare function createTaskStartedEvent(taskId: TaskId, agentId: AgentId): TaskStartedEvent;
export declare function createTaskCompletedEvent(taskId: TaskId, result: unknown, duration: number): TaskCompletedEvent;
export declare function createTaskFailedEvent(taskId: TaskId, error: Error, retryCount: number): TaskFailedEvent;
export declare function createMemoryStoredEvent(memoryId: string, namespace: string, key: string, memoryType: string, size: number): MemoryStoredEvent;
export declare function createMemoryRetrievedEvent(memoryId: string, namespace: string, key: string, accessCount: number): MemoryRetrievedEvent;
export declare function createMemoryDeletedEvent(memoryId: string, namespace: string, key: string): MemoryDeletedEvent;
export declare function createSwarmInitializedEvent(topology: string, maxAgents: number, config: Record<string, unknown>): SwarmInitializedEvent;
export declare function createSwarmScaledEvent(previousAgentCount: number, newAgentCount: number, reason: string): SwarmScaledEvent;
export declare function createSwarmTerminatedEvent(reason: string, metrics: Record<string, unknown>): SwarmTerminatedEvent;
//# sourceMappingURL=domain-events.d.ts.map