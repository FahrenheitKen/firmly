/**
 * V3 MCP HTTP Transport
 *
 * HTTP/REST transport for MCP communication:
 * - Express-based with optimized middleware
 * - WebSocket support for real-time notifications
 * - Connection pooling for client connections
 * - Security headers with helmet
 *
 * Performance Targets:
 * - Request handling: <20ms overhead
 * - WebSocket message: <5ms
 */
import { EventEmitter } from 'events';
import { ITransport, TransportType, MCPNotification, RequestHandler, NotificationHandler, TransportHealthStatus, ILogger, AuthConfig } from '../types.js';
/**
 * HTTP Transport Configuration
 */
export interface HttpTransportConfig {
    host: string;
    port: number;
    tlsEnabled?: boolean;
    tlsCert?: string;
    tlsKey?: string;
    corsEnabled?: boolean;
    corsOrigins?: string[];
    auth?: AuthConfig;
    maxRequestSize?: string;
    requestTimeout?: number;
}
/**
 * HTTP Transport Implementation
 */
export declare class HttpTransport extends EventEmitter implements ITransport {
    private readonly logger;
    private readonly config;
    readonly type: TransportType;
    private requestHandler?;
    private notificationHandler?;
    private app;
    private server?;
    private wss?;
    private running;
    private activeConnections;
    private messagesReceived;
    private messagesSent;
    private errors;
    private httpRequests;
    private wsMessages;
    constructor(logger: ILogger, config: HttpTransportConfig);
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
     * Send notification to all connected WebSocket clients
     */
    sendNotification(notification: MCPNotification): Promise<void>;
    /**
     * Setup Express middleware
     */
    private setupMiddleware;
    /**
     * Setup Express routes
     */
    private setupRoutes;
    /**
     * Setup WebSocket handlers
     */
    private setupWebSocketHandlers;
    /**
     * Handle HTTP request
     */
    private handleHttpRequest;
    /**
     * Handle WebSocket message
     */
    private handleWebSocketMessage;
    /**
     * Validate authentication
     */
    private validateAuth;
}
/**
 * Create HTTP transport
 */
export declare function createHttpTransport(logger: ILogger, config: HttpTransportConfig): HttpTransport;
//# sourceMappingURL=http.d.ts.map