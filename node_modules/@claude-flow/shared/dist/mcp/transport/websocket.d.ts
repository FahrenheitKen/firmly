/**
 * V3 MCP WebSocket Transport
 *
 * Standalone WebSocket transport for MCP communication:
 * - Native WebSocket server without HTTP dependency
 * - Binary message support for efficiency
 * - Heartbeat/ping-pong for connection health
 * - Automatic reconnection handling
 *
 * Performance Targets:
 * - Message latency: <3ms
 * - Connection overhead: <10ms
 */
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { ITransport, TransportType, MCPNotification, RequestHandler, NotificationHandler, TransportHealthStatus, ILogger, AuthConfig } from '../types.js';
/**
 * WebSocket Transport Configuration
 */
export interface WebSocketTransportConfig {
    host: string;
    port: number;
    path?: string;
    maxConnections?: number;
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
    maxMessageSize?: number;
    auth?: AuthConfig;
    enableBinaryMode?: boolean;
}
/**
 * Client connection info
 */
interface ClientConnection {
    id: string;
    ws: WebSocket;
    createdAt: Date;
    lastActivity: Date;
    messageCount: number;
    isAlive: boolean;
    isAuthenticated: boolean;
}
/**
 * WebSocket Transport Implementation
 */
export declare class WebSocketTransport extends EventEmitter implements ITransport {
    private readonly logger;
    private readonly config;
    readonly type: TransportType;
    private requestHandler?;
    private notificationHandler?;
    private server?;
    private wss?;
    private clients;
    private heartbeatTimer?;
    private running;
    private connectionCounter;
    private messagesReceived;
    private messagesSent;
    private errors;
    private totalConnections;
    constructor(logger: ILogger, config: WebSocketTransportConfig);
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
     * Send notification to all connected clients
     */
    sendNotification(notification: MCPNotification): Promise<void>;
    /**
     * Send notification to specific client
     */
    sendToClient(clientId: string, notification: MCPNotification): Promise<boolean>;
    /**
     * Get connected clients
     */
    getClients(): string[];
    /**
     * Get client info
     */
    getClientInfo(clientId: string): ClientConnection | undefined;
    /**
     * Disconnect specific client
     */
    disconnectClient(clientId: string, reason?: string): boolean;
    /**
     * Setup WebSocket handlers
     */
    private setupWebSocketHandlers;
    /**
     * Handle incoming message
     */
    private handleMessage;
    /**
     * Parse incoming message
     */
    private parseMessage;
    /**
     * Serialize outgoing message
     */
    private serializeMessage;
    /**
     * Start heartbeat interval
     */
    private startHeartbeat;
    /**
     * Stop heartbeat interval
     */
    private stopHeartbeat;
}
/**
 * Create WebSocket transport
 */
export declare function createWebSocketTransport(logger: ILogger, config: WebSocketTransportConfig): WebSocketTransport;
export {};
//# sourceMappingURL=websocket.d.ts.map