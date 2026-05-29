/**
 * V3 MCP Connection Pool Manager
 *
 * High-performance connection pooling for MCP server:
 * - Reusable connections to reduce overhead
 * - Max connections: 10 (configurable)
 * - Idle timeout handling with automatic eviction
 * - Connection health monitoring
 * - Graceful shutdown support
 *
 * Performance Targets:
 * - Connection acquire: <5ms
 * - Connection release: <1ms
 */
import { EventEmitter } from 'events';
import { PooledConnection, ConnectionPoolStats, ConnectionPoolConfig, IConnectionPool, ILogger, TransportType } from './types.js';
/**
 * Connection Pool Manager
 *
 * Manages a pool of reusable connections for optimal performance
 */
export declare class ConnectionPool extends EventEmitter implements IConnectionPool {
    private readonly logger;
    private readonly transportType;
    private readonly config;
    private readonly connections;
    private readonly waitingClients;
    private evictionTimer?;
    private connectionCounter;
    private isShuttingDown;
    private stats;
    constructor(config: Partial<ConnectionPoolConfig> | undefined, logger: ILogger, transportType?: TransportType);
    /**
     * Initialize minimum number of connections
     */
    private initializeMinConnections;
    /**
     * Create a new connection
     */
    private createConnection;
    /**
     * Acquire a connection from the pool
     */
    acquire(): Promise<PooledConnection>;
    /**
     * Wait for a connection to become available
     */
    private waitForConnection;
    /**
     * Release a connection back to the pool
     */
    release(connection: PooledConnection): void;
    /**
     * Destroy a connection (remove from pool)
     */
    destroy(connection: PooledConnection): void;
    /**
     * Get pool statistics
     */
    getStats(): ConnectionPoolStats;
    /**
     * Drain the pool (wait for all connections to be released)
     */
    drain(): Promise<void>;
    /**
     * Clear all connections from the pool
     */
    clear(): Promise<void>;
    /**
     * Start the eviction timer
     */
    private startEvictionTimer;
    /**
     * Stop the eviction timer
     */
    private stopEvictionTimer;
    /**
     * Evict idle connections that have exceeded the timeout
     */
    private evictIdleConnections;
    /**
     * Record acquire time for statistics
     */
    private recordAcquireTime;
    /**
     * Get all connections (for debugging/monitoring)
     */
    getConnections(): PooledConnection[];
    /**
     * Check if pool is healthy
     */
    isHealthy(): boolean;
}
/**
 * Create a connection pool with default settings
 */
export declare function createConnectionPool(config: Partial<ConnectionPoolConfig> | undefined, logger: ILogger, transportType?: TransportType): ConnectionPool;
//# sourceMappingURL=connection-pool.d.ts.map