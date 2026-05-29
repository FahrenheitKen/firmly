/**
 * V3 MCP Server Implementation
 *
 * Optimized MCP server with:
 * - Connection pooling for efficient resource usage
 * - Fast tool registration (<10ms)
 * - Optimized request routing (<50ms overhead)
 * - Multiple transport support (stdio, http, websocket, in-process)
 * - Session management with timeout handling
 * - Comprehensive metrics and monitoring
 *
 * Performance Targets:
 * - Server startup: <400ms
 * - Tool registration: <10ms
 * - Tool execution: <50ms overhead
 */
import { EventEmitter } from 'events';
import { MCPServerConfig, MCPSession, MCPTool, MCPServerMetrics, ILogger } from './types.js';
/**
 * MCP Server Interface
 */
export interface IMCPServer {
    start(): Promise<void>;
    stop(): Promise<void>;
    registerTool(tool: MCPTool): boolean;
    registerTools(tools: MCPTool[]): {
        registered: number;
        failed: string[];
    };
    getHealthStatus(): Promise<{
        healthy: boolean;
        error?: string;
        metrics?: Record<string, number>;
    }>;
    getMetrics(): MCPServerMetrics;
    getSessions(): MCPSession[];
    getSession(sessionId: string): MCPSession | undefined;
    terminateSession(sessionId: string): boolean;
}
/**
 * V3 MCP Server
 */
export declare class MCPServer extends EventEmitter implements IMCPServer {
    private readonly logger;
    private readonly orchestrator?;
    private readonly swarmCoordinator?;
    private readonly config;
    private readonly toolRegistry;
    private readonly sessionManager;
    private readonly connectionPool?;
    private readonly transportManager;
    private transport?;
    private running;
    private startTime?;
    private startupDuration?;
    private currentSession?;
    private readonly serverInfo;
    private readonly protocolVersion;
    private readonly capabilities;
    private requestStats;
    constructor(config: Partial<MCPServerConfig>, logger: ILogger, orchestrator?: unknown | undefined, swarmCoordinator?: unknown | undefined);
    /**
     * Start the MCP server
     */
    start(): Promise<void>;
    /**
     * Stop the MCP server
     */
    stop(): Promise<void>;
    /**
     * Register a tool
     */
    registerTool(tool: MCPTool): boolean;
    /**
     * Register multiple tools
     */
    registerTools(tools: MCPTool[]): {
        registered: number;
        failed: string[];
    };
    /**
     * Unregister a tool
     */
    unregisterTool(name: string): boolean;
    /**
     * Get health status
     */
    getHealthStatus(): Promise<{
        healthy: boolean;
        error?: string;
        metrics?: Record<string, number>;
    }>;
    /**
     * Get server metrics
     */
    getMetrics(): MCPServerMetrics;
    /**
     * Get all sessions
     */
    getSessions(): MCPSession[];
    /**
     * Get session by ID
     */
    getSession(sessionId: string): MCPSession | undefined;
    /**
     * Terminate a session
     */
    terminateSession(sessionId: string): boolean;
    /**
     * Handle incoming request
     */
    private handleRequest;
    /**
     * Handle notification
     */
    private handleNotification;
    /**
     * Handle initialize request
     */
    private handleInitialize;
    /**
     * Route request to appropriate handler
     */
    private routeRequest;
    /**
     * Handle tools/list request
     */
    private handleToolsList;
    /**
     * Handle tools/call request
     */
    private handleToolsCall;
    /**
     * Handle direct tool execution (backwards compatibility)
     */
    private handleToolExecution;
    /**
     * Handle resources/list request
     */
    private handleResourcesList;
    /**
     * Handle prompts/list request
     */
    private handlePromptsList;
    /**
     * Get or create current session
     */
    private getOrCreateSession;
    /**
     * Create error response
     */
    private createErrorResponse;
    /**
     * Register built-in tools
     */
    private registerBuiltInTools;
    /**
     * Setup event handlers
     */
    private setupEventHandlers;
}
/**
 * Create an MCP server instance
 */
export declare function createMCPServer(config: Partial<MCPServerConfig>, logger: ILogger, orchestrator?: unknown, swarmCoordinator?: unknown): MCPServer;
//# sourceMappingURL=server.d.ts.map