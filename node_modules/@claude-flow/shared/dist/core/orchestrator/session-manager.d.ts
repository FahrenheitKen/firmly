/**
 * V3 Session Manager
 * Decomposed from orchestrator.ts - Session handling
 * ~200 lines (target achieved)
 */
import type { IAgentSession } from '../interfaces/agent.interface.js';
import type { IEventBus } from '../interfaces/event.interface.js';
import type { AgentProfile } from '../../types/agent.types.js';
/**
 * Session persistence structure
 */
export interface SessionPersistence {
    sessions: Array<IAgentSession & {
        profile: AgentProfile;
    }>;
    metrics: {
        completedTasks: number;
        failedTasks: number;
        totalTaskDuration: number;
    };
    savedAt: Date;
}
/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
    persistSessions: boolean;
    dataDir: string;
    sessionRetentionMs?: number;
}
/**
 * Session manager interface
 */
export interface ISessionManager {
    createSession(profile: AgentProfile, terminalId: string, memoryBankId: string): Promise<IAgentSession>;
    getSession(sessionId: string): IAgentSession | undefined;
    getActiveSessions(): IAgentSession[];
    getSessionsByAgent(agentId: string): IAgentSession[];
    terminateSession(sessionId: string): Promise<void>;
    terminateAllSessions(): Promise<void>;
    persistSessions(): Promise<void>;
    restoreSessions(): Promise<SessionPersistence | null>;
    removeSession(sessionId: string): void;
    updateSessionActivity(sessionId: string): void;
}
/**
 * Session manager implementation
 */
export declare class SessionManager implements ISessionManager {
    private eventBus;
    private config;
    private sessions;
    private sessionProfiles;
    private persistencePath;
    constructor(eventBus: IEventBus, config: SessionManagerConfig);
    createSession(profile: AgentProfile, terminalId: string, memoryBankId: string): Promise<IAgentSession>;
    getSession(sessionId: string): IAgentSession | undefined;
    getActiveSessions(): IAgentSession[];
    getSessionsByAgent(agentId: string): IAgentSession[];
    terminateSession(sessionId: string): Promise<void>;
    terminateAllSessions(): Promise<void>;
    removeSession(sessionId: string): void;
    updateSessionActivity(sessionId: string): void;
    persistSessions(): Promise<void>;
    restoreSessions(): Promise<SessionPersistence | null>;
    /**
     * Clean up old terminated sessions
     */
    cleanupTerminatedSessions(retentionMs?: number): Promise<number>;
    /**
     * Get session profile
     */
    getSessionProfile(sessionId: string): AgentProfile | undefined;
    /**
     * Get session count
     */
    getSessionCount(): number;
    /**
     * Get active session count
     */
    getActiveSessionCount(): number;
}
//# sourceMappingURL=session-manager.d.ts.map