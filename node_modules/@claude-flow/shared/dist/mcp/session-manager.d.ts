/**
 * V3 MCP Session Manager
 *
 * Manages MCP sessions with:
 * - Session lifecycle management
 * - Authentication integration
 * - Session timeout handling
 * - Concurrent session support
 * - Session metrics and monitoring
 *
 * Performance Targets:
 * - Session creation: <5ms
 * - Session lookup: <1ms
 * - Session cleanup: <10ms
 */
import { EventEmitter } from 'events';
import { MCPSession, SessionState, SessionMetrics, MCPInitializeParams, TransportType, ILogger } from './types.js';
/**
 * Session configuration
 */
export interface SessionConfig {
    maxSessions?: number;
    sessionTimeout?: number;
    cleanupInterval?: number;
    enableMetrics?: boolean;
}
/**
 * Session Manager
 *
 * Handles creation, tracking, and cleanup of MCP sessions
 */
export declare class SessionManager extends EventEmitter {
    private readonly logger;
    private readonly sessions;
    private readonly config;
    private cleanupTimer?;
    private sessionCounter;
    private totalCreated;
    private totalClosed;
    private totalExpired;
    constructor(logger: ILogger, config?: SessionConfig);
    /**
     * Create a new session
     */
    createSession(transport: TransportType): MCPSession;
    /**
     * Initialize a session with client information
     */
    initializeSession(sessionId: string, params: MCPInitializeParams): MCPSession | undefined;
    /**
     * Authenticate a session
     */
    authenticateSession(sessionId: string): boolean;
    /**
     * Get a session by ID
     */
    getSession(sessionId: string): MCPSession | undefined;
    /**
     * Check if session exists
     */
    hasSession(sessionId: string): boolean;
    /**
     * Get all active sessions
     */
    getActiveSessions(): MCPSession[];
    /**
     * Update session activity timestamp
     */
    updateActivity(sessionId: string): boolean;
    /**
     * Set session state
     */
    setState(sessionId: string, state: SessionState): boolean;
    /**
     * Set session metadata
     */
    setMetadata(sessionId: string, key: string, value: unknown): boolean;
    /**
     * Get session metadata
     */
    getMetadata(sessionId: string, key: string): unknown;
    /**
     * Close a session
     */
    closeSession(sessionId: string, reason?: string): boolean;
    /**
     * Remove a session (alias for closeSession)
     */
    removeSession(sessionId: string): boolean;
    /**
     * Get session metrics
     */
    getSessionMetrics(): SessionMetrics;
    /**
     * Get detailed statistics
     */
    getStats(): {
        total: number;
        byState: Record<SessionState, number>;
        byTransport: Record<TransportType, number>;
        totalCreated: number;
        totalClosed: number;
        totalExpired: number;
        oldestSession?: Date;
        newestSession?: Date;
    };
    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions(): number;
    /**
     * Start cleanup timer
     */
    private startCleanupTimer;
    /**
     * Stop cleanup timer
     */
    private stopCleanupTimer;
    /**
     * Generate a unique session ID
     */
    private generateSessionId;
    /**
     * Clear all sessions
     */
    clearAll(): void;
    /**
     * Destroy the session manager
     */
    destroy(): void;
}
/**
 * Create a session manager
 */
export declare function createSessionManager(logger: ILogger, config?: SessionConfig): SessionManager;
//# sourceMappingURL=session-manager.d.ts.map