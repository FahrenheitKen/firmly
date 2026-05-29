/**
 * V3 Lifecycle Manager
 * Decomposed from orchestrator.ts - Agent spawn/terminate
 * ~150 lines (target achieved)
 */
import type { IAgent, IAgentConfig, IAgentLifecycleManager, IAgentPool, AgentStatus } from '../interfaces/agent.interface.js';
import type { IEventBus } from '../interfaces/event.interface.js';
/**
 * Agent pool implementation
 */
export declare class AgentPool implements IAgentPool {
    private agents;
    add(agent: IAgent): void;
    remove(agentId: string): boolean;
    get(agentId: string): IAgent | undefined;
    getAll(): IAgent[];
    getByStatus(status: AgentStatus): IAgent[];
    getByType(type: string): IAgent[];
    getAvailable(): IAgent[];
    size(): number;
    hasCapacity(maxSize: number): boolean;
    clear(): void;
}
/**
 * Lifecycle manager configuration
 */
export interface LifecycleManagerConfig {
    maxConcurrentAgents: number;
    spawnTimeout: number;
    terminateTimeout: number;
    maxSpawnRetries: number;
}
/**
 * Lifecycle manager implementation
 */
export declare class LifecycleManager implements IAgentLifecycleManager {
    private eventBus;
    private config;
    private pool;
    constructor(eventBus: IEventBus, config: LifecycleManagerConfig, pool?: IAgentPool);
    spawn(config: IAgentConfig): Promise<IAgent>;
    spawnBatch(configs: IAgentConfig[]): Promise<Map<string, IAgent>>;
    terminate(agentId: string, reason?: string): Promise<void>;
    terminateAll(reason?: string): Promise<void>;
    restart(agentId: string): Promise<IAgent>;
    updateConfig(agentId: string, config: Partial<IAgentConfig>): Promise<void>;
    getAgent(agentId: string): IAgent | undefined;
    getAllAgents(): IAgent[];
    getActiveCount(): number;
    checkHealth(agentId: string): Promise<IAgent['health']>;
    /**
     * Get agent pool
     */
    getPool(): IAgentPool;
}
//# sourceMappingURL=lifecycle-manager.d.ts.map