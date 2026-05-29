/**
 * V3 Event Interfaces
 * Domain-Driven Design - Event Sourcing Pattern (ADR-007)
 */
/**
 * System event types enumeration
 */
export const SystemEventTypes = {
    // System lifecycle
    SYSTEM_READY: 'system:ready',
    SYSTEM_SHUTDOWN: 'system:shutdown',
    SYSTEM_ERROR: 'system:error',
    SYSTEM_HEALTHCHECK: 'system:healthcheck',
    // Agent lifecycle
    AGENT_SPAWNED: 'agent:spawned',
    AGENT_TERMINATED: 'agent:terminated',
    AGENT_ERROR: 'agent:error',
    AGENT_IDLE: 'agent:idle',
    AGENT_BUSY: 'agent:busy',
    AGENT_HEALTH_CHANGED: 'agent:health:changed',
    // Task lifecycle
    TASK_CREATED: 'task:created',
    TASK_ASSIGNED: 'task:assigned',
    TASK_STARTED: 'task:started',
    TASK_COMPLETED: 'task:completed',
    TASK_FAILED: 'task:failed',
    TASK_CANCELLED: 'task:cancelled',
    TASK_TIMEOUT: 'task:timeout',
    TASK_RETRY: 'task:retry',
    // Session lifecycle
    SESSION_CREATED: 'session:created',
    SESSION_RESTORED: 'session:restored',
    SESSION_TERMINATED: 'session:terminated',
    SESSION_PERSISTED: 'session:persisted',
    // Memory events
    MEMORY_STORED: 'memory:stored',
    MEMORY_RETRIEVED: 'memory:retrieved',
    MEMORY_CLEARED: 'memory:cleared',
    // Coordination events
    COORDINATION_STARTED: 'coordination:started',
    COORDINATION_COMPLETED: 'coordination:completed',
    DEADLOCK_DETECTED: 'coordination:deadlock',
    // Metrics events
    METRICS_COLLECTED: 'metrics:collected',
};
//# sourceMappingURL=event.interface.js.map