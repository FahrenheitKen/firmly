/**
 * V3 Event Bus System
 * Event-driven communication for the 15-agent swarm
 *
 * Based on ADR-007 (Event Sourcing for State Changes)
 */
// =============================================================================
// Event Bus Implementation
// =============================================================================
export class EventBus {
    handlers = new Map();
    history = [];
    maxHistorySize;
    constructor(options = {}) {
        this.maxHistorySize = options.maxHistorySize ?? 10000;
    }
    subscribe(eventType, handler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        const handlers = this.handlers.get(eventType);
        handlers.add(handler);
        return () => {
            handlers.delete(handler);
        };
    }
    subscribeAll(handler) {
        if (!this.handlers.has('*')) {
            this.handlers.set('*', new Set());
        }
        const handlers = this.handlers.get('*');
        handlers.add(handler);
        return () => {
            handlers.delete(handler);
        };
    }
    async emit(event) {
        this.addToHistory(event);
        const typeHandlers = this.handlers.get(event.type) ?? new Set();
        const allHandlers = this.handlers.get('*') ?? new Set();
        const allPromises = [];
        for (const handler of typeHandlers) {
            allPromises.push(this.safeExecute(handler, event));
        }
        for (const handler of allHandlers) {
            allPromises.push(this.safeExecute(handler, event));
        }
        await Promise.all(allPromises);
    }
    emitSync(event) {
        this.addToHistory(event);
        const typeHandlers = this.handlers.get(event.type) ?? new Set();
        const allHandlers = this.handlers.get('*') ?? new Set();
        for (const handler of typeHandlers) {
            try {
                const result = handler(event);
                if (result instanceof Promise) {
                    result.catch(err => console.error(`Event handler error: ${err}`));
                }
            }
            catch (err) {
                console.error(`Event handler error: ${err}`);
            }
        }
        for (const handler of allHandlers) {
            try {
                const result = handler(event);
                if (result instanceof Promise) {
                    result.catch(err => console.error(`Event handler error: ${err}`));
                }
            }
            catch (err) {
                console.error(`Event handler error: ${err}`);
            }
        }
    }
    getHistory(filter) {
        let events = [...this.history];
        if (filter?.types?.length) {
            events = events.filter(e => filter.types.includes(e.type));
        }
        if (filter?.sources?.length) {
            events = events.filter(e => filter.sources.includes(e.source));
        }
        if (filter?.since) {
            events = events.filter(e => e.timestamp >= filter.since);
        }
        if (filter?.until) {
            events = events.filter(e => e.timestamp <= filter.until);
        }
        if (filter?.limit) {
            events = events.slice(-filter.limit);
        }
        return events;
    }
    clear() {
        this.history = [];
    }
    addToHistory(event) {
        this.history.push(event);
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-Math.floor(this.maxHistorySize / 2));
        }
    }
    async safeExecute(handler, event) {
        try {
            await handler(event);
        }
        catch (err) {
            console.error(`Event handler error for ${event.type}: ${err}`);
        }
    }
}
// =============================================================================
// In-Memory Event Store
// =============================================================================
export class InMemoryEventStore {
    events = new Map();
    allEvents = [];
    snapshots = new Map();
    async append(event) {
        const aggregateId = this.extractAggregateId(event);
        if (!this.events.has(aggregateId)) {
            this.events.set(aggregateId, []);
        }
        this.events.get(aggregateId).push(event);
        this.allEvents.push(event);
    }
    async getEvents(aggregateId, fromVersion) {
        const events = this.events.get(aggregateId) ?? [];
        if (fromVersion !== undefined) {
            return events.slice(fromVersion);
        }
        return events;
    }
    async getAllEvents(filter) {
        let events = [...this.allEvents];
        if (filter?.types?.length) {
            events = events.filter(e => filter.types.includes(e.type));
        }
        if (filter?.sources?.length) {
            events = events.filter(e => filter.sources.includes(e.source));
        }
        if (filter?.since) {
            events = events.filter(e => e.timestamp >= filter.since);
        }
        if (filter?.until) {
            events = events.filter(e => e.timestamp <= filter.until);
        }
        if (filter?.limit) {
            events = events.slice(-filter.limit);
        }
        return events;
    }
    async getSnapshot(aggregateId) {
        return this.snapshots.get(aggregateId) ?? null;
    }
    async saveSnapshot(snapshot) {
        this.snapshots.set(snapshot.aggregateId, snapshot);
    }
    extractAggregateId(event) {
        if (event.source !== 'swarm') {
            return event.source;
        }
        if (typeof event.payload === 'object' && event.payload !== null) {
            const payload = event.payload;
            if ('agentId' in payload)
                return payload.agentId;
            if ('taskId' in payload)
                return payload.taskId;
        }
        return 'swarm';
    }
}
// =============================================================================
// Event Factory Functions
// =============================================================================
let eventCounter = 0;
export function createEvent(type, source, payload) {
    return {
        id: `evt-${Date.now()}-${++eventCounter}`,
        type,
        timestamp: Date.now(),
        source,
        payload
    };
}
// Agent Events
export function agentSpawnedEvent(agentId, role) {
    return createEvent('agent:spawned', 'swarm', { agentId, role });
}
export function agentStatusChangedEvent(agentId, previousStatus, newStatus) {
    return createEvent('agent:status-changed', agentId, { previousStatus, newStatus });
}
export function agentTaskAssignedEvent(agentId, taskId) {
    return createEvent('agent:task-assigned', 'swarm', { agentId, taskId });
}
export function agentTaskCompletedEvent(agentId, taskId, result) {
    return createEvent('agent:task-completed', agentId, { taskId, result });
}
export function agentErrorEvent(agentId, error) {
    return createEvent('agent:error', agentId, {
        message: error.message,
        stack: error.stack
    });
}
// Task Events
export function taskCreatedEvent(taskId, type, title) {
    return createEvent('task:created', 'swarm', { taskId, type, title });
}
export function taskQueuedEvent(taskId, priority) {
    return createEvent('task:queued', 'swarm', { taskId, priority });
}
export function taskAssignedEvent(taskId, agentId) {
    return createEvent('task:assigned', 'swarm', { taskId, agentId });
}
export function taskStartedEvent(taskId, agentId) {
    return createEvent('task:started', agentId, { taskId });
}
export function taskCompletedEvent(taskId, result) {
    return createEvent('task:completed', 'swarm', { taskId, result });
}
export function taskFailedEvent(taskId, error) {
    return createEvent('task:failed', 'swarm', {
        taskId,
        error: error.message,
        stack: error.stack
    });
}
export function taskBlockedEvent(taskId, blockedBy) {
    return createEvent('task:blocked', 'swarm', { taskId, blockedBy });
}
// Swarm Events
export function swarmInitializedEvent(config) {
    return createEvent('swarm:initialized', 'swarm', { config });
}
export function swarmPhaseChangedEvent(previousPhase, newPhase) {
    return createEvent('swarm:phase-changed', 'swarm', { previousPhase, newPhase });
}
export function swarmMilestoneReachedEvent(milestoneId, name) {
    return createEvent('swarm:milestone-reached', 'swarm', { milestoneId, name });
}
export function swarmErrorEvent(error) {
    return createEvent('swarm:error', 'swarm', {
        message: error.message,
        stack: error.stack
    });
}
//# sourceMappingURL=events.js.map