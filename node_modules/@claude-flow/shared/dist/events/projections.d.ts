/**
 * Event Projections for Read Models (ADR-007)
 *
 * Build read models from domain events using projections.
 * Projections listen to events and maintain queryable state.
 *
 * Implemented Projections:
 * - AgentStateProjection - Current state of all agents
 * - TaskHistoryProjection - Complete task execution history
 * - MemoryIndexProjection - Memory access patterns and index
 *
 * @module v3/shared/events/projections
 */
import { EventEmitter } from 'node:events';
import { DomainEvent } from './domain-events.js';
import { EventStore } from './event-store.js';
import { AgentId, TaskId, AgentStatus, TaskStatus } from '../types.js';
export declare abstract class Projection extends EventEmitter {
    protected eventStore: EventStore;
    protected initialized: boolean;
    constructor(eventStore: EventStore);
    /**
     * Initialize the projection by replaying events
     */
    initialize(): Promise<void>;
    /**
     * Handle a domain event
     */
    abstract handle(event: DomainEvent): Promise<void>;
    /**
     * Reset the projection state
     */
    abstract reset(): void;
}
export interface AgentProjectionState {
    id: AgentId;
    role: string;
    domain: string;
    status: AgentStatus;
    currentTask: TaskId | null;
    completedTasks: TaskId[];
    failedTasks: TaskId[];
    totalTaskDuration: number;
    taskCount: number;
    errorCount: number;
    spawnedAt: number;
    startedAt: number | null;
    stoppedAt: number | null;
    lastActivityAt: number;
}
export declare class AgentStateProjection extends Projection {
    private agents;
    /**
     * Get state for a specific agent
     */
    getAgent(agentId: AgentId): AgentProjectionState | null;
    /**
     * Get all agents
     */
    getAllAgents(): AgentProjectionState[];
    /**
     * Get agents by status
     */
    getAgentsByStatus(status: AgentStatus): AgentProjectionState[];
    /**
     * Get agents by domain
     */
    getAgentsByDomain(domain: string): AgentProjectionState[];
    /**
     * Get active agent count
     */
    getActiveAgentCount(): number;
    handle(event: DomainEvent): Promise<void>;
    reset(): void;
    private handleAgentSpawned;
    private handleAgentStarted;
    private handleAgentStopped;
    private handleAgentFailed;
    private handleAgentStatusChanged;
    private handleAgentTaskAssigned;
    private handleAgentTaskCompleted;
}
export interface TaskProjectionState {
    id: TaskId;
    type: string;
    title: string;
    status: TaskStatus;
    priority: string;
    assignedAgent: AgentId | null;
    dependencies: TaskId[];
    blockedBy: TaskId[];
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    failedAt: number | null;
    duration: number | null;
    result: unknown;
    error: string | null;
    retryCount: number;
}
export declare class TaskHistoryProjection extends Projection {
    private tasks;
    /**
     * Get task by ID
     */
    getTask(taskId: TaskId): TaskProjectionState | null;
    /**
     * Get all tasks
     */
    getAllTasks(): TaskProjectionState[];
    /**
     * Get tasks by status
     */
    getTasksByStatus(status: TaskStatus): TaskProjectionState[];
    /**
     * Get tasks by agent
     */
    getTasksByAgent(agentId: AgentId): TaskProjectionState[];
    /**
     * Get completed task count
     */
    getCompletedTaskCount(): number;
    /**
     * Get average task duration
     */
    getAverageTaskDuration(): number;
    handle(event: DomainEvent): Promise<void>;
    reset(): void;
    private handleTaskCreated;
    private handleTaskQueued;
    private handleTaskStarted;
    private handleTaskCompleted;
    private handleTaskFailed;
    private handleTaskBlocked;
}
export interface MemoryProjectionState {
    id: string;
    namespace: string;
    key: string;
    type: string;
    size: number;
    accessCount: number;
    storedAt: number;
    lastAccessedAt: number;
    deletedAt: number | null;
    isDeleted: boolean;
}
export declare class MemoryIndexProjection extends Projection {
    private memories;
    /**
     * Get memory by ID
     */
    getMemory(memoryId: string): MemoryProjectionState | null;
    /**
     * Get all active memories (not deleted)
     */
    getActiveMemories(): MemoryProjectionState[];
    /**
     * Get memories by namespace
     */
    getMemoriesByNamespace(namespace: string): MemoryProjectionState[];
    /**
     * Get most accessed memories
     */
    getMostAccessedMemories(limit?: number): MemoryProjectionState[];
    /**
     * Get total memory size by namespace
     */
    getTotalSizeByNamespace(namespace: string): number;
    handle(event: DomainEvent): Promise<void>;
    reset(): void;
    private handleMemoryStored;
    private handleMemoryRetrieved;
    private handleMemoryDeleted;
    private handleMemoryExpired;
}
//# sourceMappingURL=projections.d.ts.map