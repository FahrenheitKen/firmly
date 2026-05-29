/**
 * V3 Session Manager
 * Decomposed from orchestrator.ts - Session handling
 * ~200 lines (target achieved)
 */
import { SystemEventTypes } from '../interfaces/event.interface.js';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { randomBytes } from 'crypto';
// Secure session ID generation
function generateSecureSessionId() {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(12).toString('hex');
    return `session_${timestamp}_${random}`;
}
/**
 * Session manager implementation
 */
export class SessionManager {
    eventBus;
    config;
    sessions = new Map();
    sessionProfiles = new Map();
    persistencePath;
    constructor(eventBus, config) {
        this.eventBus = eventBus;
        this.config = config;
        this.persistencePath = join(config.dataDir || './data', 'sessions.json');
    }
    async createSession(profile, terminalId, memoryBankId) {
        const session = {
            id: generateSecureSessionId(),
            agentId: profile.id,
            terminalId,
            startTime: new Date(),
            status: 'active',
            lastActivity: new Date(),
            memoryBankId,
        };
        this.sessions.set(session.id, session);
        this.sessionProfiles.set(session.id, profile);
        this.eventBus.emit(SystemEventTypes.SESSION_CREATED, {
            sessionId: session.id,
            agentId: profile.id,
            terminalId,
            memoryBankId,
        });
        // Persist sessions asynchronously
        this.persistSessions().catch(() => {
            // Silently ignore persistence errors
        });
        return session;
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter(session => session.status === 'active' || session.status === 'idle');
    }
    getSessionsByAgent(agentId) {
        return Array.from(this.sessions.values()).filter(session => session.agentId === agentId);
    }
    async terminateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        session.status = 'terminated';
        session.endTime = new Date();
        const duration = session.endTime.getTime() - session.startTime.getTime();
        this.eventBus.emit(SystemEventTypes.SESSION_TERMINATED, {
            sessionId,
            agentId: session.agentId,
            duration,
        });
        // Clean up profile reference
        this.sessionProfiles.delete(sessionId);
        // Persist sessions asynchronously
        this.persistSessions().catch(() => {
            // Silently ignore persistence errors
        });
    }
    async terminateAllSessions() {
        const sessions = this.getActiveSessions();
        const batchSize = 5;
        for (let i = 0; i < sessions.length; i += batchSize) {
            const batch = sessions.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(session => this.terminateSession(session.id)));
        }
    }
    removeSession(sessionId) {
        this.sessions.delete(sessionId);
        this.sessionProfiles.delete(sessionId);
    }
    updateSessionActivity(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
        }
    }
    async persistSessions() {
        if (!this.config.persistSessions) {
            return;
        }
        try {
            const data = {
                sessions: Array.from(this.sessions.values())
                    .map(session => ({
                    ...session,
                    profile: this.sessionProfiles.get(session.id),
                }))
                    .filter(s => s.profile),
                metrics: {
                    completedTasks: 0,
                    failedTasks: 0,
                    totalTaskDuration: 0,
                },
                savedAt: new Date(),
            };
            await mkdir(dirname(this.persistencePath), { recursive: true });
            await writeFile(this.persistencePath, JSON.stringify(data, null, 2), 'utf8');
            this.eventBus.emit(SystemEventTypes.SESSION_PERSISTED, {
                sessionCount: data.sessions.length,
                path: this.persistencePath,
            });
        }
        catch (error) {
            // Let caller handle persistence errors
            throw error;
        }
    }
    async restoreSessions() {
        if (!this.config.persistSessions) {
            return null;
        }
        try {
            const data = await readFile(this.persistencePath, 'utf8');
            const persistence = JSON.parse(data);
            // Filter to only active/idle sessions
            const sessionsToRestore = persistence.sessions.filter(s => s.status === 'active' || s.status === 'idle');
            this.eventBus.emit(SystemEventTypes.SESSION_RESTORED, {
                sessionCount: sessionsToRestore.length,
                path: this.persistencePath,
            });
            return {
                ...persistence,
                sessions: sessionsToRestore,
            };
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    /**
     * Clean up old terminated sessions
     */
    async cleanupTerminatedSessions(retentionMs) {
        const cutoffTime = Date.now() - (retentionMs ?? this.config.sessionRetentionMs ?? 3600000);
        let cleaned = 0;
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.status === 'terminated' && session.endTime) {
                if (session.endTime.getTime() < cutoffTime) {
                    this.sessions.delete(sessionId);
                    this.sessionProfiles.delete(sessionId);
                    cleaned++;
                }
            }
        }
        return cleaned;
    }
    /**
     * Get session profile
     */
    getSessionProfile(sessionId) {
        return this.sessionProfiles.get(sessionId);
    }
    /**
     * Get session count
     */
    getSessionCount() {
        return this.sessions.size;
    }
    /**
     * Get active session count
     */
    getActiveSessionCount() {
        return this.getActiveSessions().length;
    }
}
//# sourceMappingURL=session-manager.js.map