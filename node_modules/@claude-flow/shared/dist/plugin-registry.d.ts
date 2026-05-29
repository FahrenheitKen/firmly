/**
 * V3 Plugin Registry
 * Domain-Driven Design - Plugin-Based Architecture (ADR-004)
 *
 * Central registry for tracking plugin state, metadata, and registrations
 */
import type { ClaudeFlowPlugin, PluginInfo, PluginLifecycleState, PluginContext, AgentTypeDefinition, TaskTypeDefinition, MCPToolDefinition, CLICommandDefinition, MemoryBackendFactory } from './plugin-interface.js';
/**
 * Plugin registry for managing plugin lifecycle and registrations
 */
export declare class PluginRegistry {
    private plugins;
    private agentTypes;
    private taskTypes;
    private mcpTools;
    private cliCommands;
    private memoryBackends;
    /**
     * Register a plugin in the registry
     */
    registerPlugin(plugin: ClaudeFlowPlugin, initialState: PluginLifecycleState, context: PluginContext): void;
    /**
     * Unregister a plugin from the registry
     */
    unregisterPlugin(pluginName: string): boolean;
    /**
     * Get a plugin by name
     */
    getPlugin(pluginName: string): PluginInfo | undefined;
    /**
     * Get all registered plugins
     */
    getAllPlugins(): Map<string, PluginInfo>;
    /**
     * Get all plugin names
     */
    getPluginNames(): string[];
    /**
     * Check if a plugin is registered
     */
    hasPlugin(pluginName: string): boolean;
    /**
     * Get plugins by state
     */
    getPluginsByState(state: PluginLifecycleState): PluginInfo[];
    /**
     * Get plugin count
     */
    getPluginCount(): number;
    /**
     * Update plugin state
     */
    updatePluginState(pluginName: string, state: PluginLifecycleState, error?: Error): void;
    /**
     * Collect and update plugin metrics
     */
    collectPluginMetrics(pluginName: string): void;
    /**
     * Get plugin status summary
     */
    getStatusSummary(): PluginRegistryStatus;
    /**
     * Register agent types from a plugin
     */
    registerAgentTypes(pluginName: string): void;
    /**
     * Unregister agent types from a plugin
     */
    unregisterPluginAgentTypes(pluginName: string): void;
    /**
     * Get agent type definition
     */
    getAgentType(type: string): AgentTypeDefinition | undefined;
    /**
     * Get all agent types
     */
    getAllAgentTypes(): AgentTypeDefinition[];
    /**
     * Get agent types by plugin
     */
    getAgentTypesByPlugin(pluginName: string): AgentTypeDefinition[];
    /**
     * Register task types from a plugin
     */
    registerTaskTypes(pluginName: string): void;
    /**
     * Unregister task types from a plugin
     */
    unregisterPluginTaskTypes(pluginName: string): void;
    /**
     * Get task type definition
     */
    getTaskType(type: string): TaskTypeDefinition | undefined;
    /**
     * Get all task types
     */
    getAllTaskTypes(): TaskTypeDefinition[];
    /**
     * Get task types by plugin
     */
    getTaskTypesByPlugin(pluginName: string): TaskTypeDefinition[];
    /**
     * Register MCP tools from a plugin
     */
    registerMCPTools(pluginName: string): void;
    /**
     * Unregister MCP tools from a plugin
     */
    unregisterPluginMCPTools(pluginName: string): void;
    /**
     * Get MCP tool definition
     */
    getMCPTool(name: string): MCPToolDefinition | undefined;
    /**
     * Get all MCP tools
     */
    getAllMCPTools(): MCPToolDefinition[];
    /**
     * Get MCP tools by plugin
     */
    getMCPToolsByPlugin(pluginName: string): MCPToolDefinition[];
    /**
     * Register CLI commands from a plugin
     */
    registerCLICommands(pluginName: string): void;
    /**
     * Unregister CLI commands from a plugin
     */
    unregisterPluginCLICommands(pluginName: string): void;
    /**
     * Get CLI command definition
     */
    getCLICommand(name: string): CLICommandDefinition | undefined;
    /**
     * Get all CLI commands
     */
    getAllCLICommands(): CLICommandDefinition[];
    /**
     * Get CLI commands by plugin
     */
    getCLICommandsByPlugin(pluginName: string): CLICommandDefinition[];
    /**
     * Register memory backends from a plugin
     */
    registerMemoryBackends(pluginName: string): void;
    /**
     * Unregister memory backends from a plugin
     */
    unregisterPluginMemoryBackends(pluginName: string): void;
    /**
     * Get memory backend factory
     */
    getMemoryBackend(name: string): MemoryBackendFactory | undefined;
    /**
     * Get all memory backends
     */
    getAllMemoryBackends(): MemoryBackendFactory[];
    /**
     * Get memory backends by plugin
     */
    getMemoryBackendsByPlugin(pluginName: string): MemoryBackendFactory[];
    /**
     * Register all extension points from a plugin
     */
    registerAllFromPlugin(pluginName: string): void;
    /**
     * Clear all registrations (for testing)
     */
    clear(): void;
}
/**
 * Plugin registry status summary
 */
export interface PluginRegistryStatus {
    totalPlugins: number;
    states: Record<PluginLifecycleState, number>;
    agentTypesRegistered: number;
    taskTypesRegistered: number;
    mcpToolsRegistered: number;
    cliCommandsRegistered: number;
    memoryBackendsRegistered: number;
}
//# sourceMappingURL=plugin-registry.d.ts.map