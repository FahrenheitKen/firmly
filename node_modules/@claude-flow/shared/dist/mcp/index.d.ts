/**
 * V3 MCP Module
 *
 * Optimized MCP (Model Context Protocol) implementation for Claude-Flow V3
 *
 * Features:
 * - High-performance server with <400ms startup
 * - Connection pooling with max 10 connections
 * - Multiple transport support (stdio, http, websocket, in-process)
 * - Fast tool registry with <10ms registration
 * - Session management with timeout handling
 * - Comprehensive metrics and monitoring
 *
 * Performance Targets:
 * - Server startup: <400ms
 * - Tool registration: <10ms
 * - Tool execution: <50ms overhead
 * - Connection acquire: <5ms
 *
 * @module @claude-flow/mcp
 * @version 3.0.0
 */
export type { JsonRpcVersion, RequestId, MCPMessage, MCPRequest, MCPResponse, MCPNotification, MCPError, TransportType, AuthMethod, AuthConfig, LoadBalancerConfig, ConnectionPoolConfig, MCPServerConfig, SessionState, MCPSession, MCPClientInfo, MCPCapabilities, MCPProtocolVersion, MCPInitializeParams, MCPInitializeResult, JSONSchema, ToolContext, ToolHandler, MCPTool, ToolCallResult, ToolRegistrationOptions, RequestHandler, NotificationHandler, TransportHealthStatus, ITransport, ConnectionState, PooledConnection, ConnectionPoolStats, IConnectionPool, ToolCallMetrics, MCPServerMetrics, SessionMetrics, MCPEventType, MCPEvent, EventHandler, LogLevel, ILogger, } from './types.js';
import type { MCPServerConfig, ILogger } from './types.js';
export { ErrorCodes, MCPServerError } from './types.js';
import { MCPServer, createMCPServer } from './server.js';
export { MCPServer, createMCPServer };
export type { IMCPServer } from './server.js';
export { ToolRegistry, createToolRegistry, defineTool } from './tool-registry.js';
import { SessionManager, createSessionManager } from './session-manager.js';
export { SessionManager, createSessionManager };
export type { SessionConfig } from './session-manager.js';
export { ConnectionPool, createConnectionPool } from './connection-pool.js';
export { createTransport, createInProcessTransport, TransportManager, createTransportManager, DEFAULT_TRANSPORT_CONFIGS, StdioTransport, HttpTransport, WebSocketTransport, } from './transport/index.js';
export type { TransportConfig, StdioTransportConfig, HttpTransportConfig, WebSocketTransportConfig, } from './transport/index.js';
/**
 * Quick start function to create and configure an MCP server
 *
 * @example
 * ```typescript
 * import { quickStart } from '@claude-flow/mcp';
 *
 * const server = await quickStart({
 *   transport: 'stdio',
 *   name: 'My MCP Server',
 * });
 *
 * // Register custom tools
 * server.registerTool({
 *   name: 'my-tool',
 *   description: 'My custom tool',
 *   inputSchema: { type: 'object', properties: {} },
 *   handler: async () => ({ result: 'success' }),
 * });
 *
 * // Start server
 * await server.start();
 * ```
 */
export declare function quickStart(config: Partial<MCPServerConfig>, logger?: ILogger): Promise<MCPServer>;
/**
 * Module version
 */
export declare const VERSION = "3.0.0";
/**
 * Module name
 */
export declare const MODULE_NAME = "@claude-flow/mcp";
//# sourceMappingURL=index.d.ts.map