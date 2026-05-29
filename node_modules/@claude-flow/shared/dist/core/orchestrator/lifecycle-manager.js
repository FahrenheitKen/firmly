/**
 * V3 Lifecycle Manager
 * Decomposed from orchestrator.ts - Agent spawn/terminate
 * ~150 lines (target achieved)
 */
import { SystemEventTypes } from '../interfaces/event.interface.js';
/**
 * Agent pool implementation
 */
export class AgentPool {
    agents = new Map();
    add(agent) {
        this.agents.set(agent.id, agent);
    }
    remove(agentId) {
        return this.agents.delete(agentId);
    }
    get(agentId) {
        return this.agents.get(agentId);
    }
    getAll() {
        return Array.from(this.agents.values());
    }
    getByStatus(status) {
        return this.getAll().filter(agent => agent.status === status);
    }
    getByType(type) {
        return this.getAll().filter(agent => agent.type === type);
    }
    getAvailable() {
        return this.getAll().filter(agent => (agent.status === 'active' || agent.status === 'idle') &&
            agent.currentTaskCount < agent.config.maxConcurrentTasks);
    }
    size() {
        return this.agents.size;
    }
    hasCapacity(maxSize) {
        return this.agents.size < maxSize;
    }
    clear() {
        this.agents.clear();
    }
}
/**
 * Lifecycle manager implementation
 */
export class LifecycleManager {
    eventBus;
    config;
    pool;
    constructor(eventBus, config, pool) {
        this.eventBus = eventBus;
        this.config = config;
        this.pool = pool ?? new AgentPool();
    }
    async spawn(config) {
        // Validate capacity
        if (!this.pool.hasCapacity(this.config.maxConcurrentAgents)) {
            throw new Error('Maximum concurrent agents reached');
        }
        // Validate agent doesn't already exist
        if (this.pool.get(config.id)) {
            throw new Error(`Agent with ID ${config.id} already exists`);
        }
        const agent = {
            id: config.id,
            name: config.name,
            type: config.type,
            config,
            createdAt: new Date(),
            status: 'spawning',
            currentTaskCount: 0,
            lastActivity: new Date(),
            metrics: {
                tasksCompleted: 0,
                tasksFailed: 0,
                avgTaskDuration: 0,
                errorCount: 0,
                uptime: 0,
            },
        };
        // Add to pool
        this.pool.add(agent);
        // Mark as active
        agent.status = 'active';
        this.eventBus.emit(SystemEventTypes.AGENT_SPAWNED, {
            agentId: agent.id,
            profile: config,
            sessionId: undefined,
        });
        return agent;
    }
    async spawnBatch(configs) {
        const results = new Map();
        // Check total capacity
        if (this.pool.size() + configs.length > this.config.maxConcurrentAgents) {
            throw new Error('Batch would exceed maximum concurrent agents');
        }
        // Spawn in parallel
        const spawnPromises = configs.map(async (config) => {
            try {
                const agent = await this.spawn(config);
                return { id: config.id, agent, error: null };
            }
            catch (error) {
                return { id: config.id, agent: null, error };
            }
        });
        const settled = await Promise.allSettled(spawnPromises);
        for (const result of settled) {
            if (result.status === 'fulfilled' && result.value.agent) {
                results.set(result.value.id, result.value.agent);
            }
        }
        return results;
    }
    async terminate(agentId, reason) {
        const agent = this.pool.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        agent.status = 'terminated';
        // Remove from pool
        this.pool.remove(agentId);
        this.eventBus.emit(SystemEventTypes.AGENT_TERMINATED, {
            agentId,
            reason: reason ?? 'User requested',
        });
    }
    async terminateAll(reason) {
        const agents = this.pool.getAll();
        await Promise.allSettled(agents.map(agent => this.terminate(agent.id, reason)));
    }
    async restart(agentId) {
        const agent = this.pool.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        const config = agent.config;
        await this.terminate(agentId, 'Restart requested');
        return this.spawn(config);
    }
    async updateConfig(agentId, config) {
        const agent = this.pool.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        Object.assign(agent.config, config);
    }
    getAgent(agentId) {
        return this.pool.get(agentId);
    }
    getAllAgents() {
        return this.pool.getAll();
    }
    getActiveCount() {
        return this.pool.getByStatus('active').length +
            this.pool.getByStatus('idle').length;
    }
    async checkHealth(agentId) {
        const agent = this.pool.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        // Simple health check based on metrics
        const errorRate = agent.metrics
            ? agent.metrics.errorCount / Math.max(1, agent.metrics.tasksCompleted + agent.metrics.tasksFailed)
            : 0;
        const health = {
            status: errorRate > 0.5 ? 'unhealthy' : errorRate > 0.2 ? 'degraded' : 'healthy',
            lastCheck: new Date(),
            issues: [],
        };
        if (errorRate > 0.2) {
            health.issues?.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
        }
        agent.health = health;
        if (health.status !== 'healthy') {
            this.eventBus.emit(SystemEventTypes.AGENT_HEALTH_CHANGED, {
                agentId,
                previousStatus: agent.status,
                currentStatus: agent.status,
                issues: health.issues,
            });
        }
        return health;
    }
    /**
     * Get agent pool
     */
    getPool() {
        return this.pool;
    }
}
//# sourceMappingURL=lifecycle-manager.js.map