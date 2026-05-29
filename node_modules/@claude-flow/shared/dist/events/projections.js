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
// =============================================================================
// Projection Base Class
// =============================================================================
export class Projection extends EventEmitter {
    eventStore;
    initialized = false;
    constructor(eventStore) {
        super();
        this.eventStore = eventStore;
    }
    /**
     * Initialize the projection by replaying events
     */
    async initialize() {
        if (this.initialized)
            return;
        // Replay all events to build current state
        for await (const event of this.eventStore.replay()) {
            await this.handle(event);
        }
        this.initialized = true;
        this.emit('initialized');
    }
}
export class AgentStateProjection extends Projection {
    agents = new Map();
    /**
     * Get state for a specific agent
     */
    getAgent(agentId) {
        return this.agents.get(agentId) || null;
    }
    /**
     * Get all agents
     */
    getAllAgents() {
        return Array.from(this.agents.values());
    }
    /**
     * Get agents by status
     */
    getAgentsByStatus(status) {
        return this.getAllAgents().filter((agent) => agent.status === status);
    }
    /**
     * Get agents by domain
     */
    getAgentsByDomain(domain) {
        return this.getAllAgents().filter((agent) => agent.domain === domain);
    }
    /**
     * Get active agent count
     */
    getActiveAgentCount() {
        return this.getAgentsByStatus('active').length;
    }
    async handle(event) {
        switch (event.type) {
            case 'agent:spawned':
                this.handleAgentSpawned(event);
                break;
            case 'agent:started':
                this.handleAgentStarted(event);
                break;
            case 'agent:stopped':
                this.handleAgentStopped(event);
                break;
            case 'agent:failed':
                this.handleAgentFailed(event);
                break;
            case 'agent:status-changed':
                this.handleAgentStatusChanged(event);
                break;
            case 'agent:task-assigned':
                this.handleAgentTaskAssigned(event);
                break;
            case 'agent:task-completed':
                this.handleAgentTaskCompleted(event);
                break;
        }
    }
    reset() {
        this.agents.clear();
        this.emit('reset');
    }
    handleAgentSpawned(event) {
        const { agentId, role, domain } = event.payload;
        this.agents.set(agentId, {
            id: agentId,
            role: role,
            domain: domain,
            status: 'idle',
            currentTask: null,
            completedTasks: [],
            failedTasks: [],
            totalTaskDuration: 0,
            taskCount: 0,
            errorCount: 0,
            spawnedAt: event.timestamp,
            startedAt: null,
            stoppedAt: null,
            lastActivityAt: event.timestamp,
        });
        this.emit('agent:spawned', { agentId });
    }
    handleAgentStarted(event) {
        const { agentId } = event.payload;
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = 'active';
            agent.startedAt = event.timestamp;
            agent.lastActivityAt = event.timestamp;
            this.emit('agent:started', { agentId });
        }
    }
    handleAgentStopped(event) {
        const { agentId } = event.payload;
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = 'completed';
            agent.stoppedAt = event.timestamp;
            agent.lastActivityAt = event.timestamp;
            this.emit('agent:stopped', { agentId });
        }
    }
    handleAgentFailed(event) {
        const { agentId } = event.payload;
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = 'error';
            agent.errorCount++;
            agent.lastActivityAt = event.timestamp;
            this.emit('agent:failed', { agentId });
        }
    }
    handleAgentStatusChanged(event) {
        const { agentId, newStatus } = event.payload;
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = newStatus;
            agent.lastActivityAt = event.timestamp;
            this.emit('agent:status-changed', { agentId, status: newStatus });
        }
    }
    handleAgentTaskAssigned(event) {
        const { agentId, taskId } = event.payload;
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.currentTask = taskId;
            agent.status = 'active';
            agent.lastActivityAt = event.timestamp;
            this.emit('agent:task-assigned', { agentId, taskId });
        }
    }
    handleAgentTaskCompleted(event) {
        const { agentId, taskId, duration } = event.payload;
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.completedTasks.push(taskId);
            agent.currentTask = null;
            agent.taskCount++;
            agent.totalTaskDuration += duration || 0;
            agent.status = 'idle';
            agent.lastActivityAt = event.timestamp;
            this.emit('agent:task-completed', { agentId, taskId });
        }
    }
}
export class TaskHistoryProjection extends Projection {
    tasks = new Map();
    /**
     * Get task by ID
     */
    getTask(taskId) {
        return this.tasks.get(taskId) || null;
    }
    /**
     * Get all tasks
     */
    getAllTasks() {
        return Array.from(this.tasks.values());
    }
    /**
     * Get tasks by status
     */
    getTasksByStatus(status) {
        return this.getAllTasks().filter((task) => task.status === status);
    }
    /**
     * Get tasks by agent
     */
    getTasksByAgent(agentId) {
        return this.getAllTasks().filter((task) => task.assignedAgent === agentId);
    }
    /**
     * Get completed task count
     */
    getCompletedTaskCount() {
        return this.getTasksByStatus('completed').length;
    }
    /**
     * Get average task duration
     */
    getAverageTaskDuration() {
        const completed = this.getTasksByStatus('completed').filter((t) => t.duration !== null);
        if (completed.length === 0)
            return 0;
        const total = completed.reduce((sum, task) => sum + (task.duration || 0), 0);
        return total / completed.length;
    }
    async handle(event) {
        switch (event.type) {
            case 'task:created':
                this.handleTaskCreated(event);
                break;
            case 'task:queued':
                this.handleTaskQueued(event);
                break;
            case 'task:started':
                this.handleTaskStarted(event);
                break;
            case 'task:completed':
                this.handleTaskCompleted(event);
                break;
            case 'task:failed':
                this.handleTaskFailed(event);
                break;
            case 'task:blocked':
                this.handleTaskBlocked(event);
                break;
        }
    }
    reset() {
        this.tasks.clear();
        this.emit('reset');
    }
    handleTaskCreated(event) {
        const { taskId, taskType, title, priority, dependencies } = event.payload;
        this.tasks.set(taskId, {
            id: taskId,
            type: taskType,
            title: title,
            status: 'pending',
            priority: priority,
            assignedAgent: null,
            dependencies: dependencies || [],
            blockedBy: [],
            createdAt: event.timestamp,
            startedAt: null,
            completedAt: null,
            failedAt: null,
            duration: null,
            result: null,
            error: null,
            retryCount: 0,
        });
        this.emit('task:created', { taskId });
    }
    handleTaskQueued(event) {
        const { taskId } = event.payload;
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'queued';
            this.emit('task:queued', { taskId });
        }
    }
    handleTaskStarted(event) {
        const { taskId, agentId } = event.payload;
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'in-progress';
            task.assignedAgent = agentId;
            task.startedAt = event.timestamp;
            this.emit('task:started', { taskId, agentId });
        }
    }
    handleTaskCompleted(event) {
        const { taskId, result, duration } = event.payload;
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'completed';
            task.completedAt = event.timestamp;
            task.duration = duration || (task.startedAt ? event.timestamp - task.startedAt : null);
            task.result = result;
            this.emit('task:completed', { taskId });
        }
    }
    handleTaskFailed(event) {
        const { taskId, error, retryCount } = event.payload;
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'failed';
            task.failedAt = event.timestamp;
            task.error = error;
            task.retryCount = retryCount;
            this.emit('task:failed', { taskId });
        }
    }
    handleTaskBlocked(event) {
        const { taskId, blockedBy } = event.payload;
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'blocked';
            task.blockedBy = blockedBy;
            this.emit('task:blocked', { taskId, blockedBy });
        }
    }
}
export class MemoryIndexProjection extends Projection {
    memories = new Map();
    /**
     * Get memory by ID
     */
    getMemory(memoryId) {
        return this.memories.get(memoryId) || null;
    }
    /**
     * Get all active memories (not deleted)
     */
    getActiveMemories() {
        return Array.from(this.memories.values()).filter((m) => !m.isDeleted);
    }
    /**
     * Get memories by namespace
     */
    getMemoriesByNamespace(namespace) {
        return this.getActiveMemories().filter((m) => m.namespace === namespace);
    }
    /**
     * Get most accessed memories
     */
    getMostAccessedMemories(limit = 10) {
        return this.getActiveMemories()
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, limit);
    }
    /**
     * Get total memory size by namespace
     */
    getTotalSizeByNamespace(namespace) {
        return this.getMemoriesByNamespace(namespace).reduce((sum, m) => sum + m.size, 0);
    }
    async handle(event) {
        switch (event.type) {
            case 'memory:stored':
                this.handleMemoryStored(event);
                break;
            case 'memory:retrieved':
                this.handleMemoryRetrieved(event);
                break;
            case 'memory:deleted':
                this.handleMemoryDeleted(event);
                break;
            case 'memory:expired':
                this.handleMemoryExpired(event);
                break;
        }
    }
    reset() {
        this.memories.clear();
        this.emit('reset');
    }
    handleMemoryStored(event) {
        const { memoryId, namespace, key, memoryType, size } = event.payload;
        this.memories.set(memoryId, {
            id: memoryId,
            namespace: namespace,
            key: key,
            type: memoryType,
            size: size || 0,
            accessCount: 0,
            storedAt: event.timestamp,
            lastAccessedAt: event.timestamp,
            deletedAt: null,
            isDeleted: false,
        });
        this.emit('memory:stored', { memoryId });
    }
    handleMemoryRetrieved(event) {
        const { memoryId, accessCount } = event.payload;
        const memory = this.memories.get(memoryId);
        if (memory && !memory.isDeleted) {
            memory.accessCount = accessCount;
            memory.lastAccessedAt = event.timestamp;
            this.emit('memory:retrieved', { memoryId });
        }
    }
    handleMemoryDeleted(event) {
        const { memoryId } = event.payload;
        const memory = this.memories.get(memoryId);
        if (memory) {
            memory.isDeleted = true;
            memory.deletedAt = event.timestamp;
            this.emit('memory:deleted', { memoryId });
        }
    }
    handleMemoryExpired(event) {
        const { memoryId } = event.payload;
        const memory = this.memories.get(memoryId);
        if (memory) {
            memory.isDeleted = true;
            memory.deletedAt = event.timestamp;
            this.emit('memory:expired', { memoryId });
        }
    }
}
//# sourceMappingURL=projections.js.map