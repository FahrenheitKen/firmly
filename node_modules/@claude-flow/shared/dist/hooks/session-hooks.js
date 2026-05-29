/**
 * V3 Session Management Hooks
 *
 * Provides session-end and session-restore hooks for state persistence.
 * Enables cross-session memory and state recovery.
 *
 * @module v3/shared/hooks/session-hooks
 */
import { HookEvent, HookPriority, } from './types.js';
/**
 * In-memory session storage (for testing and fallback)
 */
export class InMemorySessionStorage {
    sessions = new Map();
    async save(sessionId, state) {
        this.sessions.set(sessionId, state);
    }
    async load(sessionId) {
        return this.sessions.get(sessionId) || null;
    }
    async list() {
        return Array.from(this.sessions.entries()).map(([id, state]) => ({
            id,
            startTime: state.startTime,
        }));
    }
    async delete(sessionId) {
        return this.sessions.delete(sessionId);
    }
    async getLatest() {
        let latest = null;
        for (const [id, state] of this.sessions) {
            const time = state.startTime.getTime();
            if (!latest || time > latest.time) {
                latest = { id, time };
            }
        }
        return latest?.id || null;
    }
}
/**
 * Session Hooks Manager
 *
 * Manages session lifecycle hooks with state persistence.
 */
export class SessionHooksManager {
    registry;
    storage;
    currentSessionId = null;
    sessionStartTime = null;
    activity = {
        tasksExecuted: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        commandsExecuted: 0,
        filesModified: new Set(),
        agentsSpawned: new Set(),
    };
    constructor(registry, storage) {
        this.registry = registry;
        this.storage = storage || new InMemorySessionStorage();
        this.registerDefaultHooks();
    }
    /**
     * Register default session hooks
     */
    registerDefaultHooks() {
        // Session start hook
        this.registry.register(HookEvent.SessionStart, this.handleSessionStart.bind(this), HookPriority.High, { name: 'session-hooks:start' });
        // Session end hook
        this.registry.register(HookEvent.SessionEnd, this.handleSessionEnd.bind(this), HookPriority.High, { name: 'session-hooks:end' });
        // Session resume hook (for restoration)
        this.registry.register(HookEvent.SessionResume, this.handleSessionResume.bind(this), HookPriority.High, { name: 'session-hooks:resume' });
        // Track tasks
        this.registry.register(HookEvent.PostTaskExecute, this.trackTaskExecution.bind(this), HookPriority.Low, { name: 'session-hooks:track-task' });
        // Track commands
        this.registry.register(HookEvent.PostCommand, this.trackCommandExecution.bind(this), HookPriority.Low, { name: 'session-hooks:track-command' });
        // Track file modifications
        this.registry.register(HookEvent.PostEdit, this.trackFileModification.bind(this), HookPriority.Low, { name: 'session-hooks:track-file' });
        // Track agent spawns
        this.registry.register(HookEvent.PostAgentSpawn, this.trackAgentSpawn.bind(this), HookPriority.Low, { name: 'session-hooks:track-agent' });
    }
    /**
     * Handle session start
     */
    async handleSessionStart(context) {
        this.currentSessionId = context.session?.id || `session-${Date.now()}`;
        this.sessionStartTime = new Date();
        this.resetActivity();
        return {
            success: true,
            data: {
                session: {
                    id: this.currentSessionId,
                    startTime: this.sessionStartTime,
                },
            },
        };
    }
    /**
     * Handle session end
     */
    async handleSessionEnd(context) {
        if (!this.currentSessionId || !this.sessionStartTime) {
            return { success: true }; // No active session to end
        }
        const endTime = new Date();
        const duration = endTime.getTime() - this.sessionStartTime.getTime();
        // Build session summary
        const summary = {
            tasksExecuted: this.activity.tasksExecuted,
            tasksSucceeded: this.activity.tasksSucceeded,
            tasksFailed: this.activity.tasksFailed,
            commandsExecuted: this.activity.commandsExecuted,
            filesModified: this.activity.filesModified.size,
            agentsSpawned: this.activity.agentsSpawned.size,
            duration,
        };
        // Build session state
        const state = {
            sessionId: this.currentSessionId,
            startTime: this.sessionStartTime,
            endTime,
            workingDirectory: context.metadata?.workingDirectory,
            activeTasks: context.metadata?.activeTasks,
            spawnedAgents: context.metadata?.spawnedAgents,
            memoryEntries: context.metadata?.memoryEntries,
            gitState: context.metadata?.gitState,
            learningMetrics: context.metadata?.learningMetrics,
            metadata: {
                summary,
                ...(context.metadata || {}),
            },
        };
        // Persist state
        await this.storage.save(this.currentSessionId, state);
        // Reset session tracking
        const sessionId = this.currentSessionId;
        this.currentSessionId = null;
        this.sessionStartTime = null;
        this.resetActivity();
        return {
            success: true,
            persistedState: state,
            statePath: `sessions/${sessionId}.json`,
            duration,
            summary,
        };
    }
    /**
     * Handle session resume (restoration)
     */
    async handleSessionResume(context) {
        let sessionId = context.session?.id;
        // If 'latest' is requested, get the most recent session
        if (sessionId === 'latest' || !sessionId) {
            sessionId = await this.storage.getLatest() || undefined;
        }
        if (!sessionId) {
            return {
                success: false,
                error: new Error('No session ID provided and no previous sessions found'),
                warnings: ['No sessions available for restoration'],
            };
        }
        // Load session state
        const state = await this.storage.load(sessionId);
        if (!state) {
            return {
                success: false,
                error: new Error(`Session ${sessionId} not found`),
                warnings: [`Session ${sessionId} does not exist or has been deleted`],
            };
        }
        const warnings = [];
        // Validate state age
        const stateAge = Date.now() - state.startTime.getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (stateAge > maxAge) {
            warnings.push(`Session is ${Math.floor(stateAge / (24 * 60 * 60 * 1000))} days old, some state may be stale`);
        }
        // Count restorable items
        const tasksRestored = state.activeTasks?.length || 0;
        const agentsRestored = state.spawnedAgents?.length || 0;
        const memoryRestored = state.memoryEntries?.length || 0;
        // Check for incomplete tasks
        const incompleteTasks = state.activeTasks?.filter(t => t.status === 'pending' || t.status === 'in_progress');
        if (incompleteTasks && incompleteTasks.length > 0) {
            warnings.push(`${incompleteTasks.length} tasks were incomplete when session ended`);
        }
        // Update current session tracking
        this.currentSessionId = `session-${Date.now()}-restored`;
        this.sessionStartTime = new Date();
        this.resetActivity();
        return {
            success: true,
            restoredState: state,
            tasksRestored,
            agentsRestored,
            memoryRestored,
            warnings: warnings.length > 0 ? warnings : undefined,
            data: {
                session: {
                    id: this.currentSessionId,
                    startTime: this.sessionStartTime,
                    metadata: {
                        restoredFrom: sessionId,
                        originalStartTime: state.startTime,
                    },
                },
            },
        };
    }
    /**
     * Track task execution
     */
    async trackTaskExecution(context) {
        this.activity.tasksExecuted++;
        if (context.metadata?.success !== false) {
            this.activity.tasksSucceeded++;
        }
        else {
            this.activity.tasksFailed++;
        }
        return { success: true };
    }
    /**
     * Track command execution
     */
    async trackCommandExecution(context) {
        this.activity.commandsExecuted++;
        return { success: true };
    }
    /**
     * Track file modification
     */
    async trackFileModification(context) {
        if (context.file?.path) {
            this.activity.filesModified.add(context.file.path);
        }
        return { success: true };
    }
    /**
     * Track agent spawn
     */
    async trackAgentSpawn(context) {
        if (context.agent?.id) {
            this.activity.agentsSpawned.add(context.agent.id);
        }
        return { success: true };
    }
    /**
     * Reset activity tracking
     */
    resetActivity() {
        this.activity = {
            tasksExecuted: 0,
            tasksSucceeded: 0,
            tasksFailed: 0,
            commandsExecuted: 0,
            filesModified: new Set(),
            agentsSpawned: new Set(),
        };
    }
    /**
     * Execute session-end hook manually
     */
    async executeSessionEnd(metadata) {
        const context = {
            event: HookEvent.SessionEnd,
            timestamp: new Date(),
            session: this.currentSessionId
                ? {
                    id: this.currentSessionId,
                    startTime: this.sessionStartTime,
                }
                : undefined,
            metadata,
        };
        return this.handleSessionEnd(context);
    }
    /**
     * Execute session-restore hook manually
     */
    async executeSessionRestore(sessionId, metadata) {
        const context = {
            event: HookEvent.SessionResume,
            timestamp: new Date(),
            session: {
                id: sessionId || 'latest',
                startTime: new Date(),
            },
            metadata,
        };
        return this.handleSessionResume(context);
    }
    /**
     * List available sessions
     */
    async listSessions() {
        return this.storage.list();
    }
    /**
     * Delete a session
     */
    async deleteSession(sessionId) {
        return this.storage.delete(sessionId);
    }
    /**
     * Get current session ID
     */
    getCurrentSessionId() {
        return this.currentSessionId;
    }
    /**
     * Get current session activity
     */
    getCurrentActivity() {
        return { ...this.activity };
    }
    /**
     * Set storage backend
     */
    setStorage(storage) {
        this.storage = storage;
    }
}
/**
 * Create session hooks manager
 */
export function createSessionHooksManager(registry, storage) {
    return new SessionHooksManager(registry, storage);
}
//# sourceMappingURL=session-hooks.js.map