/**
 * V3 Plugin Loader
 * Domain-Driven Design - Plugin-Based Architecture (ADR-004)
 *
 * Handles plugin loading, dependency resolution, and lifecycle management
 */
import { PluginError } from './plugin-interface.js';
/**
 * Default plugin loader configuration
 */
const DEFAULT_CONFIG = {
    initializationTimeout: 30000, // 30 seconds
    shutdownTimeout: 10000, // 10 seconds
    parallelInitialization: false, // Sequential by default for safety
    strictDependencies: true,
    enableHealthChecks: false,
    healthCheckInterval: 60000, // 1 minute
};
/**
 * Plugin loader for managing plugin lifecycle
 */
export class PluginLoader {
    config;
    registry;
    initializationOrder = [];
    healthCheckIntervalId;
    constructor(registry, config) {
        this.registry = registry;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Load a single plugin
     */
    async loadPlugin(plugin, context) {
        // Validate plugin
        this.validatePlugin(plugin);
        // Check for duplicates
        if (this.registry.hasPlugin(plugin.name)) {
            throw new PluginError(`Plugin '${plugin.name}' is already loaded`, plugin.name, 'DUPLICATE_PLUGIN');
        }
        // Register plugin in uninitialized state
        this.registry.registerPlugin(plugin, 'uninitialized', context);
        // Resolve dependencies
        if (this.config.strictDependencies) {
            this.validateDependencies(plugin);
        }
        // Initialize plugin
        await this.initializePlugin(plugin, context);
        // Update initialization order
        this.initializationOrder.push(plugin.name);
    }
    /**
     * Load multiple plugins with dependency resolution
     */
    async loadPlugins(plugins, context) {
        const results = {
            successful: [],
            failed: [],
            totalDuration: 0,
        };
        const startTime = Date.now();
        try {
            // Validate all plugins first
            for (const plugin of plugins) {
                this.validatePlugin(plugin);
            }
            // Build dependency graph
            const dependencyGraph = this.buildDependencyGraph(plugins);
            // Detect circular dependencies
            this.detectCircularDependencies(dependencyGraph);
            // Sort plugins by dependency order (topological sort)
            const sortedPlugins = this.topologicalSort(dependencyGraph);
            // Initialize plugins in order
            if (this.config.parallelInitialization) {
                await this.initializePluginsParallel(sortedPlugins, context, results);
            }
            else {
                await this.initializePluginsSequential(sortedPlugins, context, results);
            }
        }
        catch (error) {
            // If error during setup, mark all as failed
            for (const plugin of plugins) {
                if (!results.successful.includes(plugin.name) && !results.failed.some((f) => f.name === plugin.name)) {
                    results.failed.push({
                        name: plugin.name,
                        error: error instanceof Error ? error : new Error(String(error)),
                    });
                }
            }
        }
        finally {
            results.totalDuration = Date.now() - startTime;
        }
        // Start health checks if enabled
        if (this.config.enableHealthChecks) {
            this.startHealthChecks();
        }
        return results;
    }
    /**
     * Unload a single plugin
     */
    async unloadPlugin(pluginName) {
        const pluginInfo = this.registry.getPlugin(pluginName);
        if (!pluginInfo) {
            throw new PluginError(`Plugin '${pluginName}' not found`, pluginName, 'INVALID_PLUGIN');
        }
        // Check for dependents
        const dependents = this.findDependents(pluginName);
        if (dependents.length > 0) {
            throw new PluginError(`Cannot unload plugin '${pluginName}': depended on by ${dependents.join(', ')}`, pluginName, 'DEPENDENCY_NOT_FOUND');
        }
        // Shutdown plugin
        await this.shutdownPlugin(pluginInfo.plugin);
        // Unregister plugin
        this.registry.unregisterPlugin(pluginName);
        // Remove from initialization order
        const index = this.initializationOrder.indexOf(pluginName);
        if (index !== -1) {
            this.initializationOrder.splice(index, 1);
        }
    }
    /**
     * Unload all plugins in reverse initialization order
     */
    async unloadAll() {
        // Stop health checks
        if (this.healthCheckIntervalId) {
            clearInterval(this.healthCheckIntervalId);
            this.healthCheckIntervalId = undefined;
        }
        // Shutdown in reverse order
        const pluginsToShutdown = [...this.initializationOrder].reverse();
        for (const pluginName of pluginsToShutdown) {
            try {
                await this.unloadPlugin(pluginName);
            }
            catch (error) {
                // Log error but continue shutting down other plugins
                console.error(`Error unloading plugin '${pluginName}':`, error);
            }
        }
        this.initializationOrder = [];
    }
    /**
     * Reload a plugin
     */
    async reloadPlugin(pluginName, newPlugin, context) {
        await this.unloadPlugin(pluginName);
        await this.loadPlugin(newPlugin, context);
    }
    /**
     * Get plugin initialization order
     */
    getInitializationOrder() {
        return [...this.initializationOrder];
    }
    /**
     * Validate plugin interface
     */
    validatePlugin(plugin) {
        if (!plugin.name) {
            throw new PluginError('Plugin must have a name', '<unknown>', 'INVALID_PLUGIN');
        }
        if (!plugin.version) {
            throw new PluginError(`Plugin '${plugin.name}' must have a version`, plugin.name, 'INVALID_PLUGIN');
        }
        if (typeof plugin.initialize !== 'function') {
            throw new PluginError(`Plugin '${plugin.name}' must implement initialize()`, plugin.name, 'INVALID_PLUGIN');
        }
        if (typeof plugin.shutdown !== 'function') {
            throw new PluginError(`Plugin '${plugin.name}' must implement shutdown()`, plugin.name, 'INVALID_PLUGIN');
        }
    }
    /**
     * Validate plugin dependencies
     */
    validateDependencies(plugin) {
        if (!plugin.dependencies || plugin.dependencies.length === 0) {
            return;
        }
        for (const dep of plugin.dependencies) {
            if (!this.registry.hasPlugin(dep)) {
                throw new PluginError(`Plugin '${plugin.name}' depends on '${dep}' which is not loaded`, plugin.name, 'DEPENDENCY_NOT_FOUND');
            }
            // Check dependency is initialized
            const depInfo = this.registry.getPlugin(dep);
            if (depInfo && depInfo.state !== 'initialized') {
                throw new PluginError(`Plugin '${plugin.name}' depends on '${dep}' which is not initialized (state: ${depInfo.state})`, plugin.name, 'DEPENDENCY_NOT_FOUND');
            }
        }
    }
    /**
     * Initialize a single plugin
     */
    async initializePlugin(plugin, context) {
        this.registry.updatePluginState(plugin.name, 'initializing');
        try {
            // Run initialization with timeout
            await this.withTimeout(plugin.initialize(context), this.config.initializationTimeout, `Plugin '${plugin.name}' initialization timed out`);
            this.registry.updatePluginState(plugin.name, 'initialized');
            this.registry.collectPluginMetrics(plugin.name);
        }
        catch (error) {
            this.registry.updatePluginState(plugin.name, 'error', error instanceof Error ? error : new Error(String(error)));
            throw new PluginError(`Failed to initialize plugin '${plugin.name}': ${error}`, plugin.name, 'INITIALIZATION_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Shutdown a single plugin
     */
    async shutdownPlugin(plugin) {
        this.registry.updatePluginState(plugin.name, 'shutting-down');
        try {
            await this.withTimeout(plugin.shutdown(), this.config.shutdownTimeout, `Plugin '${plugin.name}' shutdown timed out`);
            this.registry.updatePluginState(plugin.name, 'shutdown');
        }
        catch (error) {
            this.registry.updatePluginState(plugin.name, 'error', error instanceof Error ? error : new Error(String(error)));
            throw new PluginError(`Failed to shutdown plugin '${plugin.name}': ${error}`, plugin.name, 'SHUTDOWN_FAILED', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Initialize plugins sequentially
     */
    async initializePluginsSequential(plugins, context, results) {
        for (const plugin of plugins) {
            try {
                // Register and initialize
                this.registry.registerPlugin(plugin, 'uninitialized', context);
                await this.initializePlugin(plugin, context);
                results.successful.push(plugin.name);
                this.initializationOrder.push(plugin.name);
            }
            catch (error) {
                results.failed.push({
                    name: plugin.name,
                    error: error instanceof Error ? error : new Error(String(error)),
                });
                // Stop on first failure in sequential mode if strict
                if (this.config.strictDependencies) {
                    break;
                }
            }
        }
    }
    /**
     * Initialize plugins in parallel (by dependency level)
     */
    async initializePluginsParallel(plugins, context, results) {
        // Group plugins by dependency depth
        const dependencyGraph = this.buildDependencyGraph(plugins);
        const levels = this.groupByDepth(dependencyGraph);
        // Initialize each level in parallel
        for (const level of levels) {
            const promises = level.map(async (plugin) => {
                try {
                    this.registry.registerPlugin(plugin, 'uninitialized', context);
                    await this.initializePlugin(plugin, context);
                    results.successful.push(plugin.name);
                    this.initializationOrder.push(plugin.name);
                }
                catch (error) {
                    results.failed.push({
                        name: plugin.name,
                        error: error instanceof Error ? error : new Error(String(error)),
                    });
                }
            });
            await Promise.all(promises);
            // Stop on failures in level if strict
            if (this.config.strictDependencies && results.failed.length > 0) {
                break;
            }
        }
    }
    /**
     * Build dependency graph
     */
    buildDependencyGraph(plugins) {
        const graph = new Map();
        // Create nodes
        for (const plugin of plugins) {
            graph.set(plugin.name, {
                plugin,
                dependencies: new Set(plugin.dependencies || []),
                dependents: new Set(),
                depth: 0,
            });
        }
        // Build dependency links
        for (const [name, node] of Array.from(graph.entries())) {
            for (const dep of Array.from(node.dependencies)) {
                const depNode = graph.get(dep);
                if (depNode) {
                    depNode.dependents.add(name);
                }
            }
        }
        // Calculate depths
        this.calculateDepths(graph);
        return graph;
    }
    /**
     * Calculate depth of each node (for topological sorting)
     */
    calculateDepths(graph) {
        const visited = new Set();
        const visit = (name) => {
            if (visited.has(name)) {
                const node = graph.get(name);
                return node ? node.depth : 0;
            }
            visited.add(name);
            const node = graph.get(name);
            if (!node)
                return 0;
            let maxDepth = 0;
            for (const dep of Array.from(node.dependencies)) {
                maxDepth = Math.max(maxDepth, visit(dep) + 1);
            }
            node.depth = maxDepth;
            return maxDepth;
        };
        for (const name of Array.from(graph.keys())) {
            visit(name);
        }
    }
    /**
     * Topological sort (dependency order)
     */
    topologicalSort(graph) {
        const sorted = [];
        const nodes = Array.from(graph.values());
        // Sort by depth (dependencies first)
        nodes.sort((a, b) => a.depth - b.depth);
        for (const node of nodes) {
            sorted.push(node.plugin);
        }
        return sorted;
    }
    /**
     * Group plugins by dependency depth (for parallel initialization)
     */
    groupByDepth(graph) {
        const levels = [];
        const maxDepth = Math.max(...Array.from(graph.values()).map((n) => n.depth));
        for (let depth = 0; depth <= maxDepth; depth++) {
            const level = [];
            for (const node of Array.from(graph.values())) {
                if (node.depth === depth) {
                    level.push(node.plugin);
                }
            }
            if (level.length > 0) {
                levels.push(level);
            }
        }
        return levels;
    }
    /**
     * Detect circular dependencies
     */
    detectCircularDependencies(graph) {
        const visited = new Set();
        const stack = new Set();
        const visit = (name, path) => {
            if (stack.has(name)) {
                const cycle = [...path, name];
                throw new PluginError(`Circular dependency detected: ${cycle.join(' -> ')}`, name, 'CIRCULAR_DEPENDENCY');
            }
            if (visited.has(name)) {
                return;
            }
            visited.add(name);
            stack.add(name);
            const node = graph.get(name);
            if (node) {
                for (const dep of Array.from(node.dependencies)) {
                    visit(dep, [...path, name]);
                }
            }
            stack.delete(name);
        };
        for (const name of Array.from(graph.keys())) {
            visit(name, []);
        }
    }
    /**
     * Find plugins that depend on a given plugin
     */
    findDependents(pluginName) {
        const dependents = [];
        for (const [name, info] of Array.from(this.registry.getAllPlugins().entries())) {
            if (info.plugin.dependencies?.includes(pluginName)) {
                dependents.push(name);
            }
        }
        return dependents;
    }
    /**
     * Start periodic health checks
     */
    startHealthChecks() {
        this.healthCheckIntervalId = setInterval(async () => {
            for (const [name, info] of Array.from(this.registry.getAllPlugins().entries())) {
                if (info.state === 'initialized' && info.plugin.healthCheck) {
                    try {
                        const healthy = await info.plugin.healthCheck();
                        if (!healthy) {
                            console.warn(`Plugin '${name}' health check failed`);
                            this.registry.updatePluginState(name, 'error', new Error('Health check failed'));
                        }
                    }
                    catch (error) {
                        console.error(`Plugin '${name}' health check error:`, error);
                        this.registry.updatePluginState(name, 'error', error instanceof Error ? error : new Error(String(error)));
                    }
                }
            }
        }, this.config.healthCheckInterval);
    }
    /**
     * Utility: Run promise with timeout
     */
    async withTimeout(promise, timeoutMs, errorMessage) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeoutMs)),
        ]);
    }
}
//# sourceMappingURL=plugin-loader.js.map