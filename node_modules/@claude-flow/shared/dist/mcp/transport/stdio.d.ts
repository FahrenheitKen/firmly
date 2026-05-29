/**
 * V3 MCP Stdio Transport
 *
 * Standard I/O transport for MCP communication:
 * - Optimized JSON parsing with streaming
 * - Buffer management for large messages
 * - Graceful shutdown handling
 *
 * Performance Targets:
 * - Message parsing: <5ms
 * - Response sending: <2ms
 */
import { EventEmitter } from 'events';
import { ITransport, TransportType, MCPNotification, RequestHandler, NotificationHandler, TransportHealthStatus, ILogger } from '../types.js';
/**
 * Stdio Transport Configuration
 */
export interface StdioTransportConfig {
    inputStream?: NodeJS.ReadableStream;
    outputStream?: NodeJS.WritableStream;
    maxMessageSize?: number;
}
/**
 * Stdio Transport Implementation
 *
 * Uses readline for efficient line-by-line processing of JSON-RPC messages
 */
export declare class StdioTransport extends EventEmitter implements ITransport {
    private readonly logger;
    readonly type: TransportType;
    private requestHandler?;
    private notificationHandler?;
    private rl?;
    private running;
    private messageBuffer;
    private messagesReceived;
    private messagesSent;
    private errors;
    private readonly inputStream;
    private readonly outputStream;
    private readonly maxMessageSize;
    constructor(logger: ILogger, config?: StdioTransportConfig);
    /**
     * Start the transport
     */
    start(): Promise<void>;
    /**
     * Stop the transport
     */
    stop(): Promise<void>;
    /**
     * Register request handler
     */
    onRequest(handler: RequestHandler): void;
    /**
     * Register notification handler
     */
    onNotification(handler: NotificationHandler): void;
    /**
     * Get health status
     */
    getHealthStatus(): Promise<TransportHealthStatus>;
    /**
     * Handle incoming line
     */
    private handleLine;
    /**
     * Handle MCP request
     */
    private handleRequest;
    /**
     * Handle MCP notification
     */
    private handleNotification;
    /**
     * Send response to stdout
     */
    private sendResponse;
    /**
     * Send error response
     */
    private sendError;
    /**
     * Send notification to stdout
     */
    sendNotification(notification: MCPNotification): Promise<void>;
    /**
     * Write to output stream
     */
    private write;
    /**
     * Handle stream close
     */
    private handleClose;
    /**
     * Handle stream error
     */
    private handleError;
}
/**
 * Create stdio transport
 */
export declare function createStdioTransport(logger: ILogger, config?: StdioTransportConfig): StdioTransport;
//# sourceMappingURL=stdio.d.ts.map