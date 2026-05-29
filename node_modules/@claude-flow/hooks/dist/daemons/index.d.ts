/**
 * V3 Daemon Manager
 *
 * Manages background daemon processes for:
 * - Metrics collection
 * - Swarm monitoring
 * - Pattern learning consolidation
 * - Statusline updates
 */
import type { DaemonConfig, DaemonState, DaemonManagerConfig } from '../types.js';
/**
 * Daemon instance
 */
interface DaemonInstance {
    config: DaemonConfig;
    state: DaemonState;
    timer?: ReturnType<typeof setInterval>;
    task?: () => Promise<void>;
}
/**
 * Daemon Manager - controls background daemon processes
 */
export declare class DaemonManager {
    private config;
    private daemons;
    private restartCounts;
    constructor(config?: Partial<DaemonManagerConfig>);
    /**
     * Register a daemon
     */
    register(config: DaemonConfig, task: () => Promise<void>): void;
    /**
     * Start a daemon
     */
    start(name: string): Promise<void>;
    /**
     * Stop a daemon
     */
    stop(name: string): Promise<void>;
    /**
     * Restart a daemon
     */
    restart(name: string): Promise<void>;
    /**
     * Start all registered daemons
     */
    startAll(): Promise<void>;
    /**
     * Stop all daemons
     */
    stopAll(): Promise<void>;
    /**
     * Get daemon state
     */
    getState(name: string): DaemonState | undefined;
    /**
     * Get all daemon states
     */
    getAllStates(): DaemonState[];
    /**
     * Check if daemon is running
     */
    isRunning(name: string): boolean;
    /**
     * Update daemon interval
     */
    updateInterval(name: string, interval: number): void;
    /**
     * Enable a daemon
     */
    enable(name: string): void;
    /**
     * Disable a daemon
     */
    disable(name: string): void;
    /**
     * Get daemon count
     */
    get count(): number;
    /**
     * Get running daemon count
     */
    get runningCount(): number;
    /**
     * Execute a daemon task
     */
    private executeDaemonTask;
}
/**
 * Metrics Daemon - collects and syncs metrics
 */
export declare class MetricsDaemon {
    private manager;
    private metricsStore;
    constructor(manager?: DaemonManager);
    /**
     * Start metrics collection
     */
    start(): Promise<void>;
    /**
     * Stop metrics collection
     */
    stop(): Promise<void>;
    /**
     * Sync metrics
     */
    private syncMetrics;
    /**
     * Get current metrics
     */
    getMetrics(): Record<string, unknown>;
}
/**
 * Swarm Monitor Daemon - monitors swarm activity
 */
export declare class SwarmMonitorDaemon {
    private manager;
    private swarmData;
    constructor(manager?: DaemonManager);
    /**
     * Start swarm monitoring
     */
    start(): Promise<void>;
    /**
     * Stop swarm monitoring
     */
    stop(): Promise<void>;
    /**
     * Check swarm status
     */
    private checkSwarm;
    /**
     * Get swarm data
     */
    getSwarmData(): typeof this.swarmData;
    /**
     * Update active agent count
     */
    updateAgentCount(count: number): void;
    /**
     * Set coordination state
     */
    setCoordinationActive(active: boolean): void;
}
/**
 * Hooks Learning Daemon - consolidates learned patterns using ReasoningBank
 */
export declare class HooksLearningDaemon {
    private manager;
    private patternsLearned;
    private routingAccuracy;
    private reasoningBank;
    private lastConsolidation;
    private consolidationStats;
    constructor(manager?: DaemonManager);
    /**
     * Start learning consolidation
     */
    start(): Promise<void>;
    /**
     * Stop learning consolidation
     */
    stop(): Promise<void>;
    /**
     * Consolidate learned patterns using ReasoningBank
     */
    private consolidate;
    /**
     * Get learning stats
     */
    getStats(): {
        patternsLearned: number;
        routingAccuracy: number;
        consolidationStats: {
            totalRuns: number;
            patternsPromoted: number;
            patternsPruned: number;
            duplicatesRemoved: number;
        };
        lastConsolidation: Date | null;
    };
    /**
     * Update pattern count
     */
    updatePatternCount(count: number): void;
    /**
     * Update routing accuracy
     */
    updateRoutingAccuracy(accuracy: number): void;
    /**
     * Get ReasoningBank stats (if available)
     */
    getReasoningBankStats(): any;
    /**
     * Force immediate consolidation
     */
    forceConsolidate(): Promise<void>;
}
/**
 * Default daemon manager instance
 */
export declare const defaultDaemonManager: DaemonManager;
export { DaemonManager as default, type DaemonInstance, };
//# sourceMappingURL=index.d.ts.map