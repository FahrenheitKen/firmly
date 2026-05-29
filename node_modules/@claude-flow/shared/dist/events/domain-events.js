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
// =============================================================================
// Event Factory Functions
// =============================================================================
let eventCounter = 0;
function createDomainEvent(type, aggregateId, aggregateType, payload, metadata, causationId, correlationId) {
    return {
        id: `evt-${Date.now()}-${++eventCounter}`,
        type,
        aggregateId,
        aggregateType,
        version: 1, // Version will be set by event store
        timestamp: Date.now(),
        source: 'swarm', // Default to swarm, can be overridden
        payload,
        metadata,
        causationId,
        correlationId,
    };
}
// Agent Event Factories
export function createAgentSpawnedEvent(agentId, role, domain, capabilities) {
    return createDomainEvent('agent:spawned', agentId, 'agent', {
        agentId,
        role,
        domain,
        capabilities,
    });
}
export function createAgentStartedEvent(agentId) {
    return createDomainEvent('agent:started', agentId, 'agent', {
        agentId,
        startedAt: Date.now(),
    });
}
export function createAgentStoppedEvent(agentId, reason) {
    return createDomainEvent('agent:stopped', agentId, 'agent', {
        agentId,
        reason,
        stoppedAt: Date.now(),
    });
}
export function createAgentFailedEvent(agentId, error) {
    return createDomainEvent('agent:failed', agentId, 'agent', {
        agentId,
        error: error.message,
        stack: error.stack,
        failedAt: Date.now(),
    });
}
export function createAgentTaskAssignedEvent(agentId, taskId, assignedAt) {
    return createDomainEvent('agent:task-assigned', agentId, 'agent', {
        agentId,
        taskId,
        assignedAt: assignedAt ?? Date.now(),
    });
}
export function createAgentTaskCompletedEvent(agentId, taskId, result, completedAt, duration) {
    return createDomainEvent('agent:task-completed', agentId, 'agent', {
        agentId,
        taskId,
        result,
        completedAt,
        duration,
    });
}
// Task Event Factories
export function createTaskCreatedEvent(taskId, taskType, title, description, priority, dependencies) {
    return createDomainEvent('task:created', taskId, 'task', {
        taskId,
        taskType,
        title,
        description,
        priority,
        dependencies,
        createdAt: Date.now(),
    });
}
export function createTaskStartedEvent(taskId, agentId) {
    return createDomainEvent('task:started', taskId, 'task', {
        taskId,
        agentId,
        startedAt: Date.now(),
    });
}
export function createTaskCompletedEvent(taskId, result, duration) {
    return createDomainEvent('task:completed', taskId, 'task', {
        taskId,
        result,
        completedAt: Date.now(),
        duration,
    });
}
export function createTaskFailedEvent(taskId, error, retryCount) {
    return createDomainEvent('task:failed', taskId, 'task', {
        taskId,
        error: error.message,
        stack: error.stack,
        failedAt: Date.now(),
        retryCount,
    });
}
// Memory Event Factories
export function createMemoryStoredEvent(memoryId, namespace, key, memoryType, size) {
    return createDomainEvent('memory:stored', memoryId, 'memory', {
        memoryId,
        namespace,
        key,
        memoryType,
        size,
        storedAt: Date.now(),
    });
}
export function createMemoryRetrievedEvent(memoryId, namespace, key, accessCount) {
    return createDomainEvent('memory:retrieved', memoryId, 'memory', {
        memoryId,
        namespace,
        key,
        retrievedAt: Date.now(),
        accessCount,
    });
}
export function createMemoryDeletedEvent(memoryId, namespace, key) {
    return createDomainEvent('memory:deleted', memoryId, 'memory', {
        memoryId,
        namespace,
        key,
        deletedAt: Date.now(),
    });
}
// Swarm Event Factories
export function createSwarmInitializedEvent(topology, maxAgents, config) {
    return createDomainEvent('swarm:initialized', 'swarm', 'swarm', {
        topology,
        maxAgents,
        config,
        initializedAt: Date.now(),
    });
}
export function createSwarmScaledEvent(previousAgentCount, newAgentCount, reason) {
    return createDomainEvent('swarm:scaled', 'swarm', 'swarm', {
        previousAgentCount,
        newAgentCount,
        scaledAt: Date.now(),
        reason,
    });
}
export function createSwarmTerminatedEvent(reason, metrics) {
    return createDomainEvent('swarm:terminated', 'swarm', 'swarm', {
        reason,
        terminatedAt: Date.now(),
        metrics,
    });
}
//# sourceMappingURL=domain-events.js.map