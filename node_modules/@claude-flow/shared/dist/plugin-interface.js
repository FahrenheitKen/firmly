/**
 * V3 Plugin Interface
 * Domain-Driven Design - Plugin-Based Architecture (ADR-004)
 *
 * Microkernel pattern for extensible Claude-Flow V3
 * Enables modular extension points for agents, tasks, MCP tools, CLI commands, and memory backends
 */
/**
 * Plugin error types
 */
export class PluginError extends Error {
    pluginName;
    code;
    cause;
    constructor(message, pluginName, code, cause) {
        super(message);
        this.pluginName = pluginName;
        this.code = code;
        this.cause = cause;
        this.name = 'PluginError';
    }
}
//# sourceMappingURL=plugin-interface.js.map