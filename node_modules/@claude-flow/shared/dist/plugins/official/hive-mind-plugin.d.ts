/**
 * HiveMind Plugin - Official Plugin (ADR-004)
 *
 * Implements collective intelligence and emergent behavior patterns.
 * Part of the official plugin collection.
 *
 * @module v3/shared/plugins/official/hive-mind
 */
import type { ClaudeFlowPlugin, PluginContext, PluginConfig } from '../types.js';
/**
 * HiveMind configuration
 */
export interface HiveMindConfig extends PluginConfig {
    consensusThreshold: number;
    collectiveMemoryEnabled: boolean;
    emergentBehaviorEnabled: boolean;
    maxVotingRounds: number;
    decisionTimeout: number;
}
/**
 * Collective decision
 */
export interface CollectiveDecision {
    id: string;
    question: string;
    votes: Map<string, {
        agentId: string;
        vote: string;
        confidence: number;
    }>;
    consensus?: string;
    consensusConfidence: number;
    timestamp: Date;
}
/**
 * Emergent pattern
 */
export interface EmergentPattern {
    id: string;
    type: string;
    description: string;
    contributors: string[];
    strength: number;
    discoveredAt: Date;
}
/**
 * HiveMind Plugin Implementation
 */
export declare class HiveMindPlugin implements ClaudeFlowPlugin {
    readonly id = "hive-mind";
    readonly name = "HiveMind Collective Intelligence";
    readonly version = "1.0.0";
    readonly description = "Collective intelligence with consensus mechanisms and emergent behavior";
    private context?;
    private config;
    private decisions;
    private patterns;
    private collectiveMemory;
    constructor(config?: Partial<HiveMindConfig>);
    initialize(context: PluginContext): Promise<void>;
    shutdown(): Promise<void>;
    /**
     * Request a collective decision from the swarm
     */
    requestDecision(question: string, options: string[]): Promise<CollectiveDecision>;
    /**
     * Submit a vote for a decision
     */
    submitVote(decisionId: string, agentId: string, vote: string, confidence: number): boolean;
    /**
     * Get decision result
     */
    getDecision(decisionId: string): CollectiveDecision | undefined;
    /**
     * Detect emergent patterns from agent behavior
     */
    private detectEmergentPatterns;
    /**
     * Get emergent patterns
     */
    getEmergentPatterns(): EmergentPattern[];
    /**
     * Store in collective memory
     */
    storeCollective(key: string, value: unknown): void;
    /**
     * Retrieve from collective memory
     */
    retrieveCollective(key: string): unknown;
    /**
     * Get collective memory statistics
     */
    getCollectiveStats(): {
        totalEntries: number;
        patterns: number;
        decisions: number;
        topPatterns: EmergentPattern[];
    };
    private generateTaskKey;
    private recalculateConsensus;
}
/**
 * Factory function
 */
export declare function createHiveMindPlugin(config?: Partial<HiveMindConfig>): HiveMindPlugin;
//# sourceMappingURL=hive-mind-plugin.d.ts.map