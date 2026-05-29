/**
 * State Reconstructor - ADR-007 Implementation
 *
 * Reconstructs aggregate state from event streams.
 * Implements event sourcing patterns for V3.
 *
 * @module v3/shared/events/state-reconstructor
 */
/**
 * State Reconstructor
 *
 * Reconstructs aggregate state from event history.
 * Supports snapshots for performance optimization.
 */
export class StateReconstructor {
    eventStore;
    options;
    constructor(eventStore, options) {
        this.eventStore = eventStore;
        this.options = {
            useSnapshots: true,
            snapshotInterval: 100,
            maxEventsToReplay: 10000,
            ...options,
        };
    }
    /**
     * Reconstruct aggregate state from events
     */
    async reconstruct(aggregateId, factory) {
        const aggregate = factory(aggregateId);
        // Try to load from snapshot first
        if (this.options.useSnapshots) {
            const snapshot = await this.eventStore.getSnapshot(aggregateId);
            if (snapshot) {
                this.applySnapshot(aggregate, snapshot);
            }
        }
        // Get events after snapshot version (or all if no snapshot)
        const events = await this.eventStore.getEvents(aggregateId, aggregate.version + 1);
        // Apply events
        for (const event of events) {
            if (events.length > this.options.maxEventsToReplay) {
                throw new Error(`Too many events to replay (${events.length}). Consider creating a snapshot.`);
            }
            aggregate.apply(event);
        }
        // Create snapshot if interval reached
        if (this.options.useSnapshots && aggregate.version % this.options.snapshotInterval === 0) {
            await this.createSnapshot(aggregate);
        }
        return aggregate;
    }
    /**
     * Reconstruct state at a specific point in time
     */
    async reconstructAtTime(aggregateId, factory, timestamp) {
        const aggregate = factory(aggregateId);
        // Get all events up to timestamp
        const allEvents = await this.eventStore.getEvents(aggregateId);
        const events = allEvents.filter((e) => e.timestamp <= timestamp.getTime());
        // Apply events
        for (const event of events) {
            aggregate.apply(event);
        }
        return aggregate;
    }
    /**
     * Reconstruct state at a specific version
     */
    async reconstructAtVersion(aggregateId, factory, targetVersion) {
        const aggregate = factory(aggregateId);
        // Get events up to target version
        const events = await this.eventStore.getEvents(aggregateId);
        const limitedEvents = events.filter((e) => e.version <= targetVersion);
        // Apply events
        for (const event of limitedEvents) {
            aggregate.apply(event);
        }
        return aggregate;
    }
    /**
     * Apply snapshot to aggregate
     */
    applySnapshot(aggregate, snapshot) {
        // Type assertion for aggregate that has restoreFromSnapshot
        const restorable = aggregate;
        if (typeof restorable.restoreFromSnapshot === 'function') {
            restorable.restoreFromSnapshot(snapshot.state);
        }
        // Update version
        aggregate.version = snapshot.version;
    }
    /**
     * Create snapshot for aggregate
     */
    async createSnapshot(aggregate) {
        const snapshot = {
            aggregateId: aggregate.id,
            aggregateType: this.getAggregateType(aggregate),
            version: aggregate.version,
            state: aggregate.getState(),
            timestamp: Date.now(),
        };
        await this.eventStore.saveSnapshot(snapshot);
    }
    /**
     * Get aggregate type from instance
     */
    getAggregateType(aggregate) {
        const typeName = aggregate.constructor.name.toLowerCase().replace('aggregate', '');
        // Map to valid aggregate types
        if (typeName === 'agent' || typeName === 'task' || typeName === 'memory' || typeName === 'swarm') {
            return typeName;
        }
        return 'agent'; // Default fallback
    }
}
/**
 * Agent Aggregate - Example implementation
 */
export class AgentAggregate {
    id;
    version = 0;
    state = {
        name: '',
        role: '',
        status: 'idle',
        currentTask: null,
        completedTasks: [],
        capabilities: [],
        createdAt: null,
        lastActiveAt: null,
    };
    constructor(id) {
        this.id = id;
    }
    apply(event) {
        this.version = event.version;
        switch (event.type) {
            case 'agent:spawned':
                this.state.name = event.payload.name;
                this.state.role = event.payload.role;
                this.state.capabilities = event.payload.capabilities ?? [];
                this.state.status = 'idle';
                this.state.createdAt = new Date(event.timestamp);
                break;
            case 'agent:started':
                this.state.status = 'active';
                this.state.lastActiveAt = new Date(event.timestamp);
                break;
            case 'agent:task-assigned':
                this.state.currentTask = event.payload.taskId;
                this.state.status = 'busy';
                this.state.lastActiveAt = new Date(event.timestamp);
                break;
            case 'agent:task-completed':
                this.state.completedTasks.push(event.payload.taskId);
                this.state.currentTask = null;
                this.state.status = 'active';
                this.state.lastActiveAt = new Date(event.timestamp);
                break;
            case 'agent:terminated':
                this.state.status = 'terminated';
                break;
        }
    }
    getState() {
        return { ...this.state };
    }
    restoreFromSnapshot(snapshotState) {
        const state = snapshotState;
        this.state = {
            ...state,
            createdAt: state.createdAt ? new Date(state.createdAt) : null,
            lastActiveAt: state.lastActiveAt ? new Date(state.lastActiveAt) : null,
        };
    }
    // Getters for type safety
    get name() { return this.state.name; }
    get role() { return this.state.role; }
    get status() { return this.state.status; }
    get currentTask() { return this.state.currentTask; }
    get completedTasks() { return [...this.state.completedTasks]; }
    get capabilities() { return [...this.state.capabilities]; }
}
/**
 * Task Aggregate - Example implementation
 */
export class TaskAggregate {
    id;
    version = 0;
    state = {
        title: '',
        description: '',
        type: '',
        priority: 'normal',
        status: 'pending',
        assignedAgent: null,
        result: null,
        createdAt: null,
        startedAt: null,
        completedAt: null,
    };
    constructor(id) {
        this.id = id;
    }
    apply(event) {
        this.version = event.version;
        switch (event.type) {
            case 'task:created':
                this.state.title = event.payload.title;
                this.state.description = event.payload.description;
                this.state.type = event.payload.taskType;
                this.state.priority = event.payload.priority ?? 'normal';
                this.state.status = 'pending';
                this.state.createdAt = new Date(event.timestamp);
                break;
            case 'task:started':
                this.state.assignedAgent = event.payload.agentId;
                this.state.status = 'running';
                this.state.startedAt = new Date(event.timestamp);
                break;
            case 'task:completed':
                this.state.result = event.payload.result;
                this.state.status = 'completed';
                this.state.completedAt = new Date(event.timestamp);
                break;
            case 'task:failed':
                this.state.status = 'failed';
                this.state.completedAt = new Date(event.timestamp);
                break;
            case 'task:cancelled':
                this.state.status = 'cancelled';
                this.state.completedAt = new Date(event.timestamp);
                break;
        }
    }
    getState() {
        return { ...this.state };
    }
    restoreFromSnapshot(snapshotState) {
        const state = snapshotState;
        this.state = {
            ...state,
            createdAt: state.createdAt ? new Date(state.createdAt) : null,
            startedAt: state.startedAt ? new Date(state.startedAt) : null,
            completedAt: state.completedAt ? new Date(state.completedAt) : null,
        };
    }
    // Getters
    get title() { return this.state.title; }
    get status() { return this.state.status; }
    get assignedAgent() { return this.state.assignedAgent; }
    get result() { return this.state.result; }
}
/**
 * Factory function
 */
export function createStateReconstructor(eventStore, options) {
    return new StateReconstructor(eventStore, options);
}
//# sourceMappingURL=state-reconstructor.js.map