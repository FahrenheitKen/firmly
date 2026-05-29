/**
 * V3 Hooks MCP Tools
 *
 * MCP tool definitions for hooks system integration.
 * These tools provide programmatic access to hooks functionality.
 */
/**
 * MCP Tool definition interface
 */
interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
    handler: (input: Record<string, unknown>, context?: unknown) => Promise<unknown>;
}
/**
 * Pre-edit hook MCP tool
 */
export declare const preEditTool: MCPTool;
/**
 * Post-edit hook MCP tool
 */
export declare const postEditTool: MCPTool;
/**
 * Route task MCP tool
 */
export declare const routeTaskTool: MCPTool;
/**
 * Metrics query MCP tool
 */
export declare const metricsTool: MCPTool;
/**
 * Pre-command hook MCP tool
 */
export declare const preCommandTool: MCPTool;
/**
 * Post-command hook MCP tool
 */
export declare const postCommandTool: MCPTool;
/**
 * Daemon status MCP tool
 */
export declare const daemonStatusTool: MCPTool;
/**
 * Statusline data MCP tool
 */
export declare const statuslineTool: MCPTool;
/**
 * All hooks MCP tools
 */
export declare const hooksMCPTools: MCPTool[];
/**
 * Get tool by name
 */
export declare function getHooksTool(name: string): MCPTool | undefined;
export { type MCPTool };
//# sourceMappingURL=index.d.ts.map