/**
 * V3 Session Management Hooks
 *
 * Provides session-end and session-restore hooks for state persistence.
 * Enables cross-session memory and state recovery.
 *
 * @module v3/shared/hooks/session-hooks
 */
import { HookContext, HookResult } from './types.js';
import { HookRegistry } from './registry.js';
/**
 * Session state to persist
 */
export interface SessionState {
    /** Session ID */
    sessionId: string;
    /** Session start time */
    startTime: Date;
    /** Session end time */
    endTime?: Date;
    /** Working directory */
    workingDirectory?: string;
    /** Active tasks */
    activeTasks?: Array<{
        id: string;
        description: string;
        status: 'pending' | 'in_progress' | 'completed' | 'failed';
    }>;
    /** Spawned agents */
    spawnedAgents?: Array<{
        id: string;
        type: string;
        status: 'active' | 'idle' | 'terminated';
    }>;
    /** Memory entries */
    memoryEntries?: Array<{
        key: string;
        namespace: string;
        type: string;
    }>;
    /** Git state */
    gitState?: {
        branch: string;
        uncommittedChanges: number;
        lastCommit?: string;
    };
    /** Learning metrics */
    learningMetrics?: {
        patternsLearned: number;
        trajectoryCount: number;
        avgConfidence: number;
    };
    /** Custom metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Session-end hook result
 */
export interface SessionEndHookResult extends HookResult {
    /** Session state that was persisted */
    persistedState?: SessionState;
    /** File path where state was saved */
    statePath?: string;
    /** Duration of the session in ms */
    duration?: number;
    /** Summary of session activity */
    summary?: SessionSummary;
}
/**
 * Session-restore hook result
 */
export interface SessionRestoreHookResult extends HookResult {
    /** Restored session state */
    restoredState?: SessionState;
    /** Number of tasks restored */
    tasksRestored?: number;
    /** Number of agents restored */
    agentsRestored?: number;
    /** Memory entries restored */
    memoryRestored?: number;
    /** Warnings during restoration */
    warnings?: string[];
}
/**
 * Session summary
 */
export interface SessionSummary {
    /** Total tasks executed */
    tasksExecuted: number;
    /** Successful tasks */
    tasksSucceeded: number;
    /** Failed tasks */
    tasksFailed: number;
    /** Commands executed */
    commandsExecuted: number;
    /** Files modified */
    filesModified: number;
    /** Agents spawned */
    agentsSpawned: number;
    /** Duration in ms */
    duration: number;
}
/**
 * Session storage interface
 */
export interface SessionStorage {
    /** Save session state */
    save(sessionId: string, state: SessionState): Promise<void>;
    /** Load session state */
    load(sessionId: string): Promise<SessionState | null>;
    /** List available sessions */
    list(): Promise<Array<{
        id: string;
        startTime: Date;
        summary?: SessionSummary;
    }>>;
    /** Delete session */
    delete(sessionId: string): Promise<boolean>;
    /** Get latest session ID */
    getLatest(): Promise<string | null>;
}
/**
 * In-memory session storage (for testing and fallback)
 */
export declare class InMemorySessionStorage implements SessionStorage {
    private sessions;
    save(sessionId: string, state: SessionState): Promise<void>;
    load(sessionId: string): Promise<SessionState | null>;
    list(): Promise<Array<{
        id: string;
        startTime: Date;
        summary?: SessionSummary;
    }>>;
    delete(sessionId: string): Promise<boolean>;
    getLatest(): Promise<string | null>;
}
/**
 * Session activity tracker
 */
interface SessionActivity {
    tasksExecuted: number;
    tasksSucceeded: number;
    tasksFailed: number;
    commandsExecuted: number;
    filesModified: Set<string>;
    agentsSpawned: Set<string>;
}
/**
 * Session Hooks Manager
 *
 * Manages session lifecycle hooks with state persistence.
 */
export declare class SessionHooksManager {
    private registry;
    private storage;
    private currentSessionId;
    private sessionStartTime;
    private activity;
    constructor(registry: HookRegistry, storage?: SessionStorage);
    /**
     * Register default session hooks
     */
    private registerDefaultHooks;
    /**
     * Handle session start
     */
    handleSessionStart(context: HookContext): Promise<HookResult>;
    /**
     * Handle session end
     */
    handleSessionEnd(context: HookContext): Promise<SessionEndHookResult>;
    /**
     * Handle session resume (restoration)
     */
    handleSessionResume(context: HookContext): Promise<SessionRestoreHookResult>;
    /**
     * Track task execution
     */
    private trackTaskExecution;
    /**
     * Track command execution
     */
    private trackCommandExecution;
    /**
     * Track file modification
     */
    private trackFileModification;
    /**
     * Track agent spawn
     */
    private trackAgentSpawn;
    /**
     * Reset activity tracking
     */
    private resetActivity;
    /**
     * Execute session-end hook manually
     */
    executeSessionEnd(metadata?: Record<string, unknown>): Promise<SessionEndHookResult>;
    /**
     * Execute session-restore hook manually
     */
    executeSessionRestore(sessionId?: string, metadata?: Record<string, unknown>): Promise<SessionRestoreHookResult>;
    /**
     * List available sessions
     */
    listSessions(): Promise<Array<{
        id: string;
        startTime: Date;
        summary?: SessionSummary;
    }>>;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string): Promise<boolean>;
    /**
     * Get current session ID
     */
    getCurrentSessionId(): string | null;
    /**
     * Get current session activity
     */
    getCurrentActivity(): SessionActivity;
    /**
     * Set storage backend
     */
    setStorage(storage: SessionStorage): void;
}
/**
 * Create session hooks manager
 */
export declare function createSessionHooksManager(registry: HookRegistry, storage?: SessionStorage): SessionHooksManager;
export {};
//# sourceMappingURL=session-hooks.d.ts.map