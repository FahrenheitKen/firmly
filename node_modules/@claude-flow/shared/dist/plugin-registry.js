/**
 * V3 Plugin Registry
 * Domain-Driven Design - Plugin-Based Architecture (ADR-004)
 *
 * Central registry for tracking plugin state, metadata, and registrations
 */
import { PluginError } from './plugin-interface.js';
/**
 * Plugin registry for managing plugin lifecycle and registrations
 */
export class PluginRegistry {
    plugins = new Map();
    agentTypes = new Map();
    taskTypes = new Map();
    mcpTools = new Map();
    cliCommands = new Map();
    memoryBackends = new Map();
    /**
     * Register a plugin in the registry
     */
    registerPlugin(plugin, initialState, context) {
        if (this.plugins.has(plugin.name)) {
            throw new PluginError(`Plugin '${plugin.name}' is already registered`, plugin.name, 'DUPLICATE_PLUGIN');
        }
        const info = {
            plugin,
            state: initialState,
            context,
            metrics: {
                agentTypesRegistered: 0,
                taskTypesRegistered: 0,
                mcpToolsRegistered: 0,
                cliCommandsRegistered: 0,
                memoryBackendsRegistered: 0,
            },
        };
        this.plugins.set(plugin.name, info);
    }
    /**
     * Unregister a plugin from the registry
     */
    unregisterPlugin(pluginName) {
        const info = this.plugins.get(pluginName);
        if (!info) {
            return false;
        }
        // Unregister all plugin's registrations
        this.unregisterPluginAgentTypes(pluginName);
        this.unregisterPluginTaskTypes(pluginName);
        this.unregisterPluginMCPTools(pluginName);
        this.unregisterPluginCLICommands(pluginName);
        this.unregisterPluginMemoryBackends(pluginName);
        // Remove plugin
        return this.plugins.delete(pluginName);
    }
    /**
     * Get a plugin by name
     */
    getPlugin(pluginName) {
        return this.plugins.get(pluginName);
    }
    /**
     * Get all registered plugins
     */
    getAllPlugins() {
        return new Map(this.plugins);
    }
    /**
     * Get all plugin names
     */
    getPluginNames() {
        return Array.from(this.plugins.keys());
    }
    /**
     * Check if a plugin is registered
     */
    hasPlugin(pluginName) {
        return this.plugins.has(pluginName);
    }
    /**
     * Get plugins by state
     */
    getPluginsByState(state) {
        return Array.from(this.plugins.values()).filter((info) => info.state === state);
    }
    /**
     * Get plugin count
     */
    getPluginCount() {
        return this.plugins.size;
    }
    /**
     * Update plugin state
     */
    updatePluginState(pluginName, state, error) {
        const info = this.plugins.get(pluginName);
        if (!info) {
            throw new PluginError(`Plugin '${pluginName}' not found`, pluginName, 'INVALID_PLUGIN');
        }
        info.state = state;
        if (state === 'initialized') {
            info.initializedAt = new Date();
        }
        else if (state === 'shutdown') {
            info.shutdownAt = new Date();
        }
        else if (state === 'error') {
            info.error = error;
        }
    }
    /**
     * Collect and update plugin metrics
     */
    collectPluginMetrics(pluginName) {
        const info = this.plugins.get(pluginName);
        if (!info || !info.metrics) {
            return;
        }
        const plugin = info.plugin;
        // Count registered items
        info.metrics.agentTypesRegistered = plugin.registerAgentTypes?.()?.length || 0;
        info.metrics.taskTypesRegistered = plugin.registerTaskTypes?.()?.length || 0;
        info.metrics.mcpToolsRegistered = plugin.registerMCPTools?.()?.length || 0;
        info.metrics.cliCommandsRegistered = plugin.registerCLICommands?.()?.length || 0;
        info.metrics.memoryBackendsRegistered = plugin.registerMemoryBackends?.()?.length || 0;
    }
    /**
     * Get plugin status summary
     */
    getStatusSummary() {
        const states = Array.from(this.plugins.values()).reduce((acc, info) => {
            acc[info.state] = (acc[info.state] || 0) + 1;
            return acc;
        }, {});
        return {
            totalPlugins: this.plugins.size,
            states,
            agentTypesRegistered: this.agentTypes.size,
            taskTypesRegistered: this.taskTypes.size,
            mcpToolsRegistered: this.mcpTools.size,
            cliCommandsRegistered: this.cliCommands.size,
            memoryBackendsRegistered: this.memoryBackends.size,
        };
    }
    // =============================================================================
    // Agent Type Registry
    // =============================================================================
    /**
     * Register agent types from a plugin
     */
    registerAgentTypes(pluginName) {
        const info = this.plugins.get(pluginName);
        if (!info) {
            throw new PluginError(`Plugin '${pluginName}' not found`, pluginName, 'INVALID_PLUGIN');
        }
        const agentTypes = info.plugin.registerAgentTypes?.();
        if (!agentTypes || agentTypes.length === 0) {
            return;
        }
        for (const definition of agentTypes) {
            if (this.agentTypes.has(definition.type)) {
                throw new PluginError(`Agent type '${definition.type}' is already registered by plugin '${this.agentTypes.get(definition.type)?.plugin}'`, pluginName, 'DUPLICATE_PLUGIN');
            }
            this.agentTypes.set(definition.type, { plugin: pluginName, definition });
        }
    }
    /**
     * Unregister agent types from a plugin
     */
    unregisterPluginAgentTypes(pluginName) {
        for (const [type, entry] of Array.from(this.agentTypes.entries())) {
            if (entry.plugin === pluginName) {
                this.agentTypes.delete(type);
            }
        }
    }
    /**
     * Get agent type definition
     */
    getAgentType(type) {
        return this.agentTypes.get(type)?.definition;
    }
    /**
     * Get all agent types
     */
    getAllAgentTypes() {
        return Array.from(this.agentTypes.values()).map((entry) => entry.definition);
    }
    /**
     * Get agent types by plugin
     */
    getAgentTypesByPlugin(pluginName) {
        return Array.from(this.agentTypes.values())
            .filter((entry) => entry.plugin === pluginName)
            .map((entry) => entry.definition);
    }
    // =============================================================================
    // Task Type Registry
    // =============================================================================
    /**
     * Register task types from a plugin
     */
    registerTaskTypes(pluginName) {
        const info = this.plugins.get(pluginName);
        if (!info) {
            throw new PluginError(`Plugin '${pluginName}' not found`, pluginName, 'INVALID_PLUGIN');
        }
        const taskTypes = info.plugin.registerTaskTypes?.();
        if (!taskTypes || taskTypes.length === 0) {
            return;
        }
        for (const definition of taskTypes) {
            if (this.taskTypes.has(definition.type)) {
                throw new PluginError(`Task type '${definition.type}' is already registered by plugin '${this.taskTypes.get(definition.type)?.plugin}'`, pluginName, 'DUPLICATE_PLUGIN');
            }
            this.taskTypes.set(definition.type, { plugin: pluginName, definition });
        }
    }
    /**
     * Unregister task types from a plugin
     */
    unregisterPluginTaskTypes(pluginName) {
        for (const [type, entry] of Array.from(this.taskTypes.entries())) {
            if (entry.plugin === pluginName) {
                this.taskTypes.delete(type);
            }
        }
    }
    /**
     * Get task type definition
     */
    getTaskType(type) {
        return this.taskTypes.get(type)?.definition;
    }
    /**
     * Get all task types
     */
    getAllTaskTypes() {
        return Array.from(this.taskTypes.values()).map((entry) => entry.definition);
    }
    /**
     * Get task types by plugin
     */
    getTaskTypesByPlugin(pluginName) {
        return Array.from(this.taskTypes.values())
            .filter((entry) => entry.plugin === pluginName)
            .map((entry) => entry.definition);
    }
    // =============================================================================
    // MCP Tool Registry
    // =============================================================================
    /**
     * Register MCP tools from a plugin
     */
    registerMCPTools(pluginName) {
        const info = this.plugins.get(pluginName);
        if (!info) {
            throw new PluginError(`Plugin '${pluginName}' not found`, pluginName, 'INVALID_PLUGIN');
        }
        const mcpTools = info.plugin.registerMCPTools?.();
        if (!mcpTools || mcpTools.length === 0) {
            return;
        }
        for (const definition of mcpTools) {
            if (this.mcpTools.has(definition.name)) {
                throw new PluginError(`MCP tool '${definition.name}' is already registered by plugin '${this.mcpTools.get(definition.name)?.plugin}'`, pluginName, 'DUPLICATE_PLUGIN');
            }
            // Add plugin metadata
            definition.pluginName = pluginName;
            this.mcpTools.set(definition.name, { plugin: pluginName, definition });
        }
    }
    /**
     * Unregister MCP tools from a plugin
     */
    unregisterPluginMCPTools(pluginName) {
        for (const [name, entry] of Array.from(this.mcpTools.entries())) {
            if (entry.plugin === pluginName) {
                this.mcpTools.delete(name);
            }
        }
    }
    /**
     * Get MCP tool definition
     */
    getMCPTool(name) {
        return this.mcpTools.get(name)?.definition;
    }
    /**
     * Get all MCP tools
     */
    getAllMCPTools() {
        return Array.from(this.mcpTools.values()).map((entry) => entry.definition);
    }
    /**
     * Get MCP tools by plugin
     */
    getMCPToolsByPlugin(pluginName) {
        return Array.from(this.mcpTools.values())
            .filter((entry) => entry.plugin === pluginName)
            .map((entry) => entry.definition);
    }
    // =============================================================================
    // CLI Command Registry
    // =============================================================================
    /**
     * Register CLI commands from a plugin
     */
    registerCLICommands(pluginName) {
        const info = this.plugins.get(pluginName);
        if (!info) {
            throw new PluginError(`Plugin '${pluginName}' not found`, pluginName, 'INVALID_PLUGIN');
        }
        const cliCommands = info.plugin.registerCLICommands?.();
        if (!cliCommands || cliCommands.length === 0) {
            return;
        }
        for (const definition of cliCommands) {
            if (this.cliCommands.has(definition.name)) {
                throw new PluginError(`CLI command '${definition.name}' is already registered by plugin '${this.cliCommands.get(definition.name)?.plugin}'`, pluginName, 'DUPLICATE_PLUGIN');
            }
            this.cliCommands.set(definition.name, { plugin: pluginName, definition });
            // Register aliases
            if (definition.aliases) {
                for (const alias of definition.aliases) {
                    if (this.cliCommands.has(alias)) {
                        throw new PluginError(`CLI command alias '${alias}' is already registered`, pluginName, 'DUPLICATE_PLUGIN');
                    }
                    this.cliCommands.set(alias, { plugin: pluginName, definition });
                }
            }
        }
    }
    /**
     * Unregister CLI commands from a plugin
     */
    unregisterPluginCLICommands(pluginName) {
        for (const [name, entry] of Array.from(this.cliCommands.entries())) {
            if (entry.plugin === pluginName) {
                this.cliCommands.delete(name);
            }
        }
    }
    /**
     * Get CLI command definition
     */
    getCLICommand(name) {
        return this.cliCommands.get(name)?.definition;
    }
    /**
     * Get all CLI commands
     */
    getAllCLICommands() {
        const seen = new Set();
        return Array.from(this.cliCommands.values())
            .map((entry) => entry.definition)
            .filter((def) => {
            if (seen.has(def))
                return false;
            seen.add(def);
            return true;
        });
    }
    /**
     * Get CLI commands by plugin
     */
    getCLICommandsByPlugin(pluginName) {
        const seen = new Set();
        return Array.from(this.cliCommands.values())
            .filter((entry) => entry.plugin === pluginName)
            .map((entry) => entry.definition)
            .filter((def) => {
            if (seen.has(def))
                return false;
            seen.add(def);
            return true;
        });
    }
    // =============================================================================
    // Memory Backend Registry
    // =============================================================================
    /**
     * Register memory backends from a plugin
     */
    registerMemoryBackends(pluginName) {
        const info = this.plugins.get(pluginName);
        if (!info) {
            throw new PluginError(`Plugin '${pluginName}' not found`, pluginName, 'INVALID_PLUGIN');
        }
        const memoryBackends = info.plugin.registerMemoryBackends?.();
        if (!memoryBackends || memoryBackends.length === 0) {
            return;
        }
        for (const factory of memoryBackends) {
            if (this.memoryBackends.has(factory.name)) {
                throw new PluginError(`Memory backend '${factory.name}' is already registered by plugin '${this.memoryBackends.get(factory.name)?.plugin}'`, pluginName, 'DUPLICATE_PLUGIN');
            }
            this.memoryBackends.set(factory.name, { plugin: pluginName, factory });
        }
    }
    /**
     * Unregister memory backends from a plugin
     */
    unregisterPluginMemoryBackends(pluginName) {
        for (const [name, entry] of Array.from(this.memoryBackends.entries())) {
            if (entry.plugin === pluginName) {
                this.memoryBackends.delete(name);
            }
        }
    }
    /**
     * Get memory backend factory
     */
    getMemoryBackend(name) {
        return this.memoryBackends.get(name)?.factory;
    }
    /**
     * Get all memory backends
     */
    getAllMemoryBackends() {
        return Array.from(this.memoryBackends.values()).map((entry) => entry.factory);
    }
    /**
     * Get memory backends by plugin
     */
    getMemoryBackendsByPlugin(pluginName) {
        return Array.from(this.memoryBackends.values())
            .filter((entry) => entry.plugin === pluginName)
            .map((entry) => entry.factory);
    }
    // =============================================================================
    // Bulk Registration
    // =============================================================================
    /**
     * Register all extension points from a plugin
     */
    registerAllFromPlugin(pluginName) {
        this.registerAgentTypes(pluginName);
        this.registerTaskTypes(pluginName);
        this.registerMCPTools(pluginName);
        this.registerCLICommands(pluginName);
        this.registerMemoryBackends(pluginName);
        this.collectPluginMetrics(pluginName);
    }
    /**
     * Clear all registrations (for testing)
     */
    clear() {
        this.plugins.clear();
        this.agentTypes.clear();
        this.taskTypes.clear();
        this.mcpTools.clear();
        this.cliCommands.clear();
        this.memoryBackends.clear();
    }
}
//# sourceMappingURL=plugin-registry.js.map