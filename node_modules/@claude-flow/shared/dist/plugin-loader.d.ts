/**
 * V3 Plugin Loader
 * Domain-Driven Design - Plugin-Based Architecture (ADR-004)
 *
 * Handles plugin loading, dependency resolution, and lifecycle management
 */
import type { ClaudeFlowPlugin, PluginContext } from './plugin-interface.js';
import type { PluginRegistry } from './plugin-registry.js';
/**
 * Plugin loader configuration
 */
export interface PluginLoaderConfig {
    /**
     * Maximum time to wait for plugin initialization (ms)
     */
    initializationTimeout?: number;
    /**
     * Maximum time to wait for plugin shutdown (ms)
     */
    shutdownTimeout?: number;
    /**
     * Enable parallel plugin initialization
     */
    parallelInitialization?: boolean;
    /**
     * Enable strict dependency checking
     */
    strictDependencies?: boolean;
    /**
     * Enable health checks
     */
    enableHealthChecks?: boolean;
    /**
     * Health check interval (ms)
     */
    healthCheckInterval?: number;
}
/**
 * Plugin loader for managing plugin lifecycle
 */
export declare class PluginLoader {
    private config;
    private registry;
    private initializationOrder;
    private healthCheckIntervalId?;
    constructor(registry: PluginRegistry, config?: PluginLoaderConfig);
    /**
     * Load a single plugin
     */
    loadPlugin(plugin: ClaudeFlowPlugin, context: PluginContext): Promise<void>;
    /**
     * Load multiple plugins with dependency resolution
     */
    loadPlugins(plugins: ClaudeFlowPlugin[], context: PluginContext): Promise<LoadPluginsResult>;
    /**
     * Unload a single plugin
     */
    unloadPlugin(pluginName: string): Promise<void>;
    /**
     * Unload all plugins in reverse initialization order
     */
    unloadAll(): Promise<void>;
    /**
     * Reload a plugin
     */
    reloadPlugin(pluginName: string, newPlugin: ClaudeFlowPlugin, context: PluginContext): Promise<void>;
    /**
     * Get plugin initialization order
     */
    getInitializationOrder(): string[];
    /**
     * Validate plugin interface
     */
    private validatePlugin;
    /**
     * Validate plugin dependencies
     */
    private validateDependencies;
    /**
     * Initialize a single plugin
     */
    private initializePlugin;
    /**
     * Shutdown a single plugin
     */
    private shutdownPlugin;
    /**
     * Initialize plugins sequentially
     */
    private initializePluginsSequential;
    /**
     * Initialize plugins in parallel (by dependency level)
     */
    private initializePluginsParallel;
    /**
     * Build dependency graph
     */
    private buildDependencyGraph;
    /**
     * Calculate depth of each node (for topological sorting)
     */
    private calculateDepths;
    /**
     * Topological sort (dependency order)
     */
    private topologicalSort;
    /**
     * Group plugins by dependency depth (for parallel initialization)
     */
    private groupByDepth;
    /**
     * Detect circular dependencies
     */
    private detectCircularDependencies;
    /**
     * Find plugins that depend on a given plugin
     */
    private findDependents;
    /**
     * Start periodic health checks
     */
    private startHealthChecks;
    /**
     * Utility: Run promise with timeout
     */
    private withTimeout;
}
/**
 * Load plugins result
 */
export interface LoadPluginsResult {
    successful: string[];
    failed: Array<{
        name: string;
        error: Error;
    }>;
    totalDuration: number;
}
//# sourceMappingURL=plugin-loader.d.ts.map