/**
 * MCP Tools for Worker System
 *
 * Exposes worker functionality via Model Context Protocol tools.
 */
import type { WorkerManager } from './index.js';
export interface MCPToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
    handler: (input: Record<string, unknown>, manager: WorkerManager) => Promise<MCPToolResult>;
}
export interface MCPToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
}
export declare const workerRunTool: MCPToolDefinition;
export declare const workerStatusTool: MCPToolDefinition;
export declare const workerAlertsTool: MCPToolDefinition;
export declare const workerHistoryTool: MCPToolDefinition;
export declare const workerStatuslineTool: MCPToolDefinition;
export declare const workerRunAllTool: MCPToolDefinition;
export declare const workerStartTool: MCPToolDefinition;
export declare const workerStopTool: MCPToolDefinition;
export declare const workerMCPTools: MCPToolDefinition[];
/**
 * Create a tool handler function for MCP server integration
 */
export declare function createWorkerToolHandler(manager: WorkerManager): (toolName: string, input: Record<string, unknown>) => Promise<MCPToolResult>;
//# sourceMappingURL=mcp-tools.d.ts.map