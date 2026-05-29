/**
 * V3 Health Monitor
 * Decomposed from orchestrator.ts - Agent health checks
 * ~150 lines (target achieved)
 */
import type { IHealthMonitor, IHealthStatus, IComponentHealth } from '../interfaces/coordinator.interface.js';
import type { IEventBus } from '../interfaces/event.interface.js';
/**
 * Health check function type
 */
export type HealthCheckFn = () => Promise<{
    healthy: boolean;
    error?: string;
    metrics?: Record<string, number>;
}>;
/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
    checkInterval: number;
    historyLimit: number;
    degradedThreshold: number;
    unhealthyThreshold: number;
}
/**
 * Health monitor implementation
 */
export declare class HealthMonitor implements IHealthMonitor {
    private eventBus;
    private config;
    private checks;
    private history;
    private interval?;
    private listeners;
    private running;
    constructor(eventBus: IEventBus, config?: HealthMonitorConfig);
    start(): void;
    stop(): void;
    getStatus(): Promise<IHealthStatus>;
    registerCheck(name: string, check: HealthCheckFn): void;
    unregisterCheck(name: string): void;
    getHistory(limit?: number): IHealthStatus[];
    onHealthChange(callback: (status: IHealthStatus) => void): () => void;
    private addToHistory;
    private notifyListeners;
    private timeout;
    /**
     * Get component health by name
     */
    getComponentHealth(name: string): Promise<IComponentHealth | undefined>;
    /**
     * Check if system is healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * Get registered check names
     */
    getRegisteredChecks(): string[];
}
//# sourceMappingURL=health-monitor.d.ts.map