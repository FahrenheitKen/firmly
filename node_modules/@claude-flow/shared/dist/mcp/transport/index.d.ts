/**
 * V3 MCP Transport Factory
 *
 * Central factory for creating transport instances:
 * - Unified transport creation API
 * - Transport type validation
 * - Configuration defaults
 * - Multi-transport support
 *
 * Supported transports:
 * - stdio: Standard I/O (default for CLI)
 * - http: HTTP/REST with WebSocket upgrade
 * - websocket: Standalone WebSocket
 * - in-process: Direct function calls (fastest)
 */
import { ITransport, TransportType, ILogger } from '../types.js';
import { StdioTransportConfig } from './stdio.js';
import { HttpTransportConfig } from './http.js';
import { WebSocketTransportConfig } from './websocket.js';
export { StdioTransport } from './stdio.js';
export { HttpTransport } from './http.js';
export { WebSocketTransport } from './websocket.js';
export type { StdioTransportConfig } from './stdio.js';
export type { HttpTransportConfig } from './http.js';
export type { WebSocketTransportConfig } from './websocket.js';
/**
 * Transport configuration union
 */
export type TransportConfig = {
    type: 'stdio';
} & StdioTransportConfig | {
    type: 'http';
} & HttpTransportConfig | {
    type: 'websocket';
} & WebSocketTransportConfig | {
    type: 'in-process';
};
/**
 * Create a transport instance based on type
 */
export declare function createTransport(type: TransportType, logger: ILogger, config?: Partial<TransportConfig>): ITransport;
/**
 * Create in-process transport
 */
export declare function createInProcessTransport(logger: ILogger): ITransport;
/**
 * Transport manager for multi-transport scenarios
 */
export declare class TransportManager {
    private readonly logger;
    private transports;
    private running;
    constructor(logger: ILogger);
    /**
     * Add a transport
     */
    addTransport(name: string, transport: ITransport): void;
    /**
     * Remove a transport
     */
    removeTransport(name: string): Promise<boolean>;
    /**
     * Get a transport by name
     */
    getTransport(name: string): ITransport | undefined;
    /**
     * Get all transport names
     */
    getTransportNames(): string[];
    /**
     * Start all transports
     */
    startAll(): Promise<void>;
    /**
     * Stop all transports
     */
    stopAll(): Promise<void>;
    /**
     * Get health status of all transports
     */
    getHealthStatus(): Promise<Record<string, {
        healthy: boolean;
        error?: string;
    }>>;
    /**
     * Check if any transport is running
     */
    isRunning(): boolean;
}
/**
 * Create a transport manager
 */
export declare function createTransportManager(logger: ILogger): TransportManager;
/**
 * Default transport configurations
 */
export declare const DEFAULT_TRANSPORT_CONFIGS: {
    readonly stdio: StdioTransportConfig;
    readonly http: HttpTransportConfig;
    readonly websocket: WebSocketTransportConfig;
};
//# sourceMappingURL=index.d.ts.map