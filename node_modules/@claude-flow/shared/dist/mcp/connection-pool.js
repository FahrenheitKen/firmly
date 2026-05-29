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
/**
 * Default connection pool configuration
 */
const DEFAULT_POOL_CONFIG = {
    maxConnections: 10,
    minConnections: 2,
    idleTimeout: 30000, // 30 seconds
    acquireTimeout: 5000, // 5 seconds
    maxWaitingClients: 50,
    evictionRunInterval: 10000, // 10 seconds
};
/**
 * Connection wrapper with lifecycle management
 */
class ManagedConnection {
    id;
    transport;
    createdAt;
    metadata;
    state = 'idle';
    lastUsedAt;
    useCount = 0;
    constructor(id, transport, createdAt = new Date(), metadata) {
        this.id = id;
        this.transport = transport;
        this.createdAt = createdAt;
        this.metadata = metadata;
        this.lastUsedAt = this.createdAt;
    }
    /**
     * Mark connection as busy
     */
    acquire() {
        this.state = 'busy';
        this.lastUsedAt = new Date();
        this.useCount++;
    }
    /**
     * Mark connection as idle
     */
    release() {
        this.state = 'idle';
        this.lastUsedAt = new Date();
    }
    /**
     * Check if connection is expired
     */
    isExpired(idleTimeout) {
        if (this.state !== 'idle')
            return false;
        return Date.now() - this.lastUsedAt.getTime() > idleTimeout;
    }
    /**
     * Check if connection is healthy
     */
    isHealthy() {
        return this.state !== 'error' && this.state !== 'closed';
    }
}
/**
 * Connection Pool Manager
 *
 * Manages a pool of reusable connections for optimal performance
 */
export class ConnectionPool extends EventEmitter {
    logger;
    transportType;
    config;
    connections = new Map();
    waitingClients = [];
    evictionTimer;
    connectionCounter = 0;
    isShuttingDown = false;
    // Statistics
    stats = {
        totalAcquired: 0,
        totalReleased: 0,
        totalCreated: 0,
        totalDestroyed: 0,
        acquireTimeTotal: 0,
        acquireCount: 0,
    };
    constructor(config = {}, logger, transportType = 'in-process') {
        super();
        this.logger = logger;
        this.transportType = transportType;
        this.config = { ...DEFAULT_POOL_CONFIG, ...config };
        this.startEvictionTimer();
        this.initializeMinConnections();
    }
    /**
     * Initialize minimum number of connections
     */
    async initializeMinConnections() {
        const promises = [];
        for (let i = 0; i < this.config.minConnections; i++) {
            promises.push(this.createConnection());
        }
        await Promise.all(promises);
        this.logger.debug('Connection pool initialized', {
            minConnections: this.config.minConnections,
        });
    }
    /**
     * Create a new connection
     */
    async createConnection() {
        const id = `conn-${++this.connectionCounter}-${Date.now()}`;
        const connection = new ManagedConnection(id, this.transportType);
        this.connections.set(id, connection);
        this.stats.totalCreated++;
        this.emit('pool:connection:created', { connectionId: id });
        this.logger.debug('Connection created', { id, total: this.connections.size });
        return connection;
    }
    /**
     * Acquire a connection from the pool
     */
    async acquire() {
        const startTime = performance.now();
        if (this.isShuttingDown) {
            throw new Error('Connection pool is shutting down');
        }
        // Try to find an idle connection
        for (const connection of this.connections.values()) {
            if (connection.state === 'idle' && connection.isHealthy()) {
                connection.acquire();
                this.stats.totalAcquired++;
                this.recordAcquireTime(startTime);
                this.emit('pool:connection:acquired', { connectionId: connection.id });
                this.logger.debug('Connection acquired from pool', { id: connection.id });
                return connection;
            }
        }
        // Create new connection if under limit
        if (this.connections.size < this.config.maxConnections) {
            const connection = await this.createConnection();
            connection.acquire();
            this.stats.totalAcquired++;
            this.recordAcquireTime(startTime);
            this.emit('pool:connection:acquired', { connectionId: connection.id });
            return connection;
        }
        // Wait for a connection to become available
        return this.waitForConnection(startTime);
    }
    /**
     * Wait for a connection to become available
     */
    waitForConnection(startTime) {
        return new Promise((resolve, reject) => {
            if (this.waitingClients.length >= this.config.maxWaitingClients) {
                reject(new Error('Connection pool exhausted - max waiting clients reached'));
                return;
            }
            const client = {
                resolve: (connection) => {
                    this.recordAcquireTime(startTime);
                    resolve(connection);
                },
                reject,
                timestamp: Date.now(),
            };
            this.waitingClients.push(client);
            // Set timeout
            setTimeout(() => {
                const index = this.waitingClients.indexOf(client);
                if (index !== -1) {
                    this.waitingClients.splice(index, 1);
                    reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeout}ms`));
                }
            }, this.config.acquireTimeout);
        });
    }
    /**
     * Release a connection back to the pool
     */
    release(connection) {
        const managed = this.connections.get(connection.id);
        if (!managed) {
            this.logger.warn('Attempted to release unknown connection', { id: connection.id });
            return;
        }
        // Check for waiting clients first
        const waitingClient = this.waitingClients.shift();
        if (waitingClient) {
            managed.acquire();
            this.stats.totalAcquired++;
            this.emit('pool:connection:acquired', { connectionId: connection.id });
            waitingClient.resolve(managed);
            return;
        }
        // Return to pool
        managed.release();
        this.stats.totalReleased++;
        this.emit('pool:connection:released', { connectionId: connection.id });
        this.logger.debug('Connection released to pool', { id: connection.id });
    }
    /**
     * Destroy a connection (remove from pool)
     */
    destroy(connection) {
        const managed = this.connections.get(connection.id);
        if (!managed) {
            return;
        }
        managed.state = 'closed';
        this.connections.delete(connection.id);
        this.stats.totalDestroyed++;
        this.emit('pool:connection:destroyed', { connectionId: connection.id });
        this.logger.debug('Connection destroyed', { id: connection.id });
        // Create new connection to maintain minimum if needed
        if (this.connections.size < this.config.minConnections && !this.isShuttingDown) {
            this.createConnection().catch((err) => {
                this.logger.error('Failed to create replacement connection', err);
            });
        }
    }
    /**
     * Get pool statistics
     */
    getStats() {
        let idleCount = 0;
        let busyCount = 0;
        for (const connection of this.connections.values()) {
            if (connection.state === 'idle')
                idleCount++;
            else if (connection.state === 'busy')
                busyCount++;
        }
        return {
            totalConnections: this.connections.size,
            idleConnections: idleCount,
            busyConnections: busyCount,
            pendingRequests: this.waitingClients.length,
            totalAcquired: this.stats.totalAcquired,
            totalReleased: this.stats.totalReleased,
            totalCreated: this.stats.totalCreated,
            totalDestroyed: this.stats.totalDestroyed,
            avgAcquireTime: this.stats.acquireCount > 0
                ? this.stats.acquireTimeTotal / this.stats.acquireCount
                : 0,
        };
    }
    /**
     * Drain the pool (wait for all connections to be released)
     */
    async drain() {
        this.isShuttingDown = true;
        this.logger.info('Draining connection pool');
        // Reject all waiting clients
        while (this.waitingClients.length > 0) {
            const client = this.waitingClients.shift();
            client?.reject(new Error('Connection pool is draining'));
        }
        // Wait for busy connections to be released
        const maxWait = 10000; // 10 seconds
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
            let busyCount = 0;
            for (const connection of this.connections.values()) {
                if (connection.state === 'busy')
                    busyCount++;
            }
            if (busyCount === 0)
                break;
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        this.logger.info('Connection pool drained');
    }
    /**
     * Clear all connections from the pool
     */
    async clear() {
        this.stopEvictionTimer();
        await this.drain();
        // Destroy all remaining connections
        for (const connection of this.connections.values()) {
            connection.state = 'closed';
        }
        this.connections.clear();
        this.logger.info('Connection pool cleared');
    }
    /**
     * Start the eviction timer
     */
    startEvictionTimer() {
        this.evictionTimer = setInterval(() => {
            this.evictIdleConnections();
        }, this.config.evictionRunInterval);
    }
    /**
     * Stop the eviction timer
     */
    stopEvictionTimer() {
        if (this.evictionTimer) {
            clearInterval(this.evictionTimer);
            this.evictionTimer = undefined;
        }
    }
    /**
     * Evict idle connections that have exceeded the timeout
     */
    evictIdleConnections() {
        if (this.isShuttingDown)
            return;
        const toEvict = [];
        for (const connection of this.connections.values()) {
            if (connection.isExpired(this.config.idleTimeout) &&
                this.connections.size > this.config.minConnections) {
                toEvict.push(connection);
            }
        }
        for (const connection of toEvict) {
            this.destroy(connection);
            this.logger.debug('Evicted idle connection', { id: connection.id });
        }
        if (toEvict.length > 0) {
            this.logger.info('Evicted idle connections', { count: toEvict.length });
        }
    }
    /**
     * Record acquire time for statistics
     */
    recordAcquireTime(startTime) {
        const duration = performance.now() - startTime;
        this.stats.acquireTimeTotal += duration;
        this.stats.acquireCount++;
    }
    /**
     * Get all connections (for debugging/monitoring)
     */
    getConnections() {
        return Array.from(this.connections.values());
    }
    /**
     * Check if pool is healthy
     */
    isHealthy() {
        return !this.isShuttingDown && this.connections.size >= this.config.minConnections;
    }
}
/**
 * Create a connection pool with default settings
 */
export function createConnectionPool(config = {}, logger, transportType = 'in-process') {
    return new ConnectionPool(config, logger, transportType);
}
//# sourceMappingURL=connection-pool.js.map