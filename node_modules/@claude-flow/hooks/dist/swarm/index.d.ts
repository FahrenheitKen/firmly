/**
 * V3 Swarm Communication Hooks
 *
 * Enables agent-to-agent communication, pattern broadcasting,
 * consensus building, and task handoff coordination.
 *
 * @module @claude-flow/hooks/swarm
 */
import { EventEmitter } from 'node:events';
import { type GuidancePattern } from '../reasoningbank/index.js';
/**
 * Message between agents
 */
export interface SwarmMessage {
    id: string;
    from: string;
    to: string | '*';
    type: 'context' | 'pattern' | 'handoff' | 'consensus' | 'result' | 'query';
    content: string;
    metadata: Record<string, unknown>;
    timestamp: number;
    ttl?: number;
    priority: 'low' | 'normal' | 'high' | 'critical';
}
/**
 * Pattern broadcast entry
 */
export interface PatternBroadcast {
    id: string;
    sourceAgent: string;
    pattern: GuidancePattern;
    broadcastTime: number;
    recipients: string[];
    acknowledgments: string[];
}
/**
 * Consensus request
 */
export interface ConsensusRequest {
    id: string;
    initiator: string;
    question: string;
    options: string[];
    votes: Map<string, string>;
    deadline: number;
    status: 'pending' | 'resolved' | 'expired';
    result?: {
        winner: string;
        confidence: number;
        participation: number;
    };
}
/**
 * Task handoff
 */
export interface TaskHandoff {
    id: string;
    taskId: string;
    description: string;
    fromAgent: string;
    toAgent: string;
    context: {
        filesModified: string[];
        patternsUsed: string[];
        decisions: string[];
        blockers: string[];
        nextSteps: string[];
    };
    status: 'pending' | 'accepted' | 'rejected' | 'completed';
    timestamp: number;
    completedAt?: number;
}
/**
 * Agent state in swarm
 */
export interface SwarmAgentState {
    id: string;
    name: string;
    status: 'idle' | 'busy' | 'waiting' | 'offline';
    currentTask?: string;
    lastSeen: number;
    capabilities: string[];
    patternsShared: number;
    handoffsReceived: number;
    handoffsCompleted: number;
}
/**
 * Swarm communication configuration
 */
export interface SwarmConfig {
    /** Agent ID for this instance */
    agentId: string;
    /** Agent name/role */
    agentName: string;
    /** Message retention time (ms) */
    messageRetention: number;
    /** Consensus timeout (ms) */
    consensusTimeout: number;
    /** Auto-acknowledge messages */
    autoAcknowledge: boolean;
    /** Broadcast patterns automatically */
    autoBroadcastPatterns: boolean;
    /** Pattern broadcast threshold (quality) */
    patternBroadcastThreshold: number;
}
/**
 * Swarm Communication Hub
 *
 * Manages agent-to-agent communication within the swarm.
 */
export declare class SwarmCommunication extends EventEmitter {
    private config;
    private messages;
    private broadcasts;
    private consensusRequests;
    private handoffs;
    private agents;
    private initialized;
    private cleanupTimer?;
    private metrics;
    constructor(config?: Partial<SwarmConfig>);
    /**
     * Initialize swarm communication
     */
    initialize(): Promise<void>;
    /**
     * Shutdown swarm communication and cleanup resources
     */
    shutdown(): Promise<void>;
    /**
     * Send a message to another agent
     */
    sendMessage(to: string, content: string, options?: {
        type?: SwarmMessage['type'];
        priority?: SwarmMessage['priority'];
        metadata?: Record<string, unknown>;
        ttl?: number;
    }): Promise<SwarmMessage>;
    /**
     * Get messages for this agent
     */
    getMessages(options?: {
        from?: string;
        type?: SwarmMessage['type'];
        since?: number;
        limit?: number;
    }): SwarmMessage[];
    /**
     * Broadcast context to all agents
     */
    broadcastContext(content: string, metadata?: Record<string, unknown>): Promise<SwarmMessage>;
    /**
     * Query other agents
     */
    queryAgents(query: string): Promise<SwarmMessage>;
    /**
     * Broadcast a learned pattern to the swarm
     */
    broadcastPattern(pattern: GuidancePattern, targetAgents?: string[]): Promise<PatternBroadcast>;
    /**
     * Acknowledge receipt of a pattern broadcast
     */
    acknowledgeBroadcast(broadcastId: string): boolean;
    /**
     * Get recent pattern broadcasts
     */
    getPatternBroadcasts(options?: {
        since?: number;
        domain?: string;
        minQuality?: number;
    }): PatternBroadcast[];
    /**
     * Import a broadcast pattern into local ReasoningBank
     */
    importBroadcastPattern(broadcastId: string): Promise<boolean>;
    /**
     * Initiate a consensus request
     */
    initiateConsensus(question: string, options: string[], timeout?: number): Promise<ConsensusRequest>;
    /**
     * Vote on a consensus request
     */
    voteConsensus(consensusId: string, vote: string): boolean;
    /**
     * Resolve a consensus request
     */
    private resolveConsensus;
    /**
     * Get consensus request by ID
     */
    getConsensus(consensusId: string): ConsensusRequest | undefined;
    /**
     * Get pending consensus requests
     */
    getPendingConsensus(): ConsensusRequest[];
    /**
     * Generate consensus guidance text
     */
    generateConsensusGuidance(consensusId: string): string;
    /**
     * Initiate a task handoff to another agent
     */
    initiateHandoff(toAgent: string, taskDescription: string, context: TaskHandoff['context']): Promise<TaskHandoff>;
    /**
     * Accept a task handoff
     */
    acceptHandoff(handoffId: string): boolean;
    /**
     * Reject a task handoff
     */
    rejectHandoff(handoffId: string, reason?: string): boolean;
    /**
     * Complete a task handoff
     */
    completeHandoff(handoffId: string, result?: Record<string, unknown>): boolean;
    /**
     * Get handoff by ID
     */
    getHandoff(handoffId: string): TaskHandoff | undefined;
    /**
     * Get pending handoffs for this agent
     */
    getPendingHandoffs(): TaskHandoff[];
    /**
     * Generate handoff context text for Claude
     */
    generateHandoffContext(handoffId: string): string;
    /**
     * Register an agent in the swarm
     */
    registerAgent(agent: SwarmAgentState): void;
    /**
     * Update agent status
     */
    updateAgentStatus(agentId: string, status: SwarmAgentState['status']): void;
    /**
     * Get all registered agents
     */
    getAgents(): SwarmAgentState[];
    /**
     * Get agent by ID
     */
    getAgent(agentId: string): SwarmAgentState | undefined;
    /**
     * Get communication statistics
     */
    getStats(): {
        agentId: string;
        agentCount: number;
        metrics: {
            messagesSent: number;
            messagesReceived: number;
            patternsBroadcast: number;
            consensusInitiated: number;
            consensusResolved: number;
            handoffsInitiated: number;
            handoffsCompleted: number;
        };
        pendingMessages: number;
        pendingHandoffs: number;
        pendingConsensus: number;
    };
    /**
     * Cleanup old messages and data
     */
    private cleanup;
    private ensureInitialized;
}
export declare const swarmComm: SwarmCommunication;
export { SwarmCommunication as default, };
//# sourceMappingURL=index.d.ts.map