/**
 * V3 ReasoningBank Adapter
 *
 * Provides agentic-flow@alpha compatible ReasoningBank interface:
 * - 4-step pipeline: RETRIEVE, JUDGE, DISTILL, CONSOLIDATE
 * - Trajectory tracking and verdict judgment
 * - Memory distillation from successful trajectories
 * - Pattern consolidation with deduplication and pruning
 *
 * Based on Algorithm 3 & 4 from ReasoningBank paper.
 *
 * Performance Targets:
 * - Pattern retrieval: <5ms
 * - Verdict judgment: <10ms
 * - Memory distillation: <50ms
 * - Consolidation: <100ms
 */
import type { Trajectory, SONAMode } from './types.js';
/**
 * ReasoningBank pattern record
 */
export interface ReasoningBankPattern {
    id: string;
    type: 'reasoning_memory' | 'strategy' | 'pattern';
    domain: string;
    patternData: {
        title: string;
        description: string;
        content: string;
        source: {
            taskId: string;
            agentId: string;
            outcome: 'Success' | 'Failure' | 'Partial';
            evidence: string[];
        };
        tags: string[];
        domain: string;
        createdAt: string;
        confidence: number;
        nUses: number;
    };
    confidence: number;
    usageCount: number;
    embedding: Float32Array;
    createdAt: number;
    lastUsed: number;
}
/**
 * Verdict from trajectory judgment
 */
export interface ReasoningBankVerdict {
    label: 'Success' | 'Failure' | 'Partial';
    score: number;
    evidence: string[];
    reasoning: string;
}
/**
 * Consolidation result
 */
export interface ConsolidationResult {
    itemsProcessed: number;
    duplicatesFound: number;
    contradictionsFound: number;
    itemsPruned: number;
    durationMs: number;
}
/**
 * ReasoningBank configuration
 */
export interface ReasoningBankConfig {
    /** Database path */
    dbPath?: string;
    /** Enable learning */
    enableLearning?: boolean;
    /** Enable reasoning agents */
    enableReasoning?: boolean;
    /** SONA mode */
    sonaMode?: SONAMode;
    /** Duplicate similarity threshold */
    duplicateThreshold?: number;
    /** Contradiction similarity threshold */
    contradictionThreshold?: number;
    /** Maximum age for pruning (days) */
    pruneAgeDays?: number;
    /** Minimum confidence to keep */
    minConfidenceKeep?: number;
    /** Consolidation trigger threshold */
    consolidateTriggerThreshold?: number;
    /** Maximum items for success distillation */
    maxItemsSuccess?: number;
    /** Maximum items for failure distillation */
    maxItemsFailure?: number;
    /** Confidence prior for success */
    confidencePriorSuccess?: number;
    /** Confidence prior for failure */
    confidencePriorFailure?: number;
}
export declare class ReasoningBankAdapter {
    private readonly config;
    private readonly sonaManager;
    private readonly patternLearner;
    private patterns;
    private newPatternsSinceConsolidation;
    private initialized;
    constructor(config?: ReasoningBankConfig);
    initialize(): Promise<void>;
    /**
     * Retrieve relevant patterns for a query
     */
    retrieve(queryEmbedding: Float32Array, options?: {
        k?: number;
        domain?: string;
        minConfidence?: number;
        useMmr?: boolean;
        mmrLambda?: number;
    }): Promise<ReasoningBankPattern[]>;
    /**
     * Judge a trajectory's success
     */
    judge(trajectory: Trajectory): Promise<ReasoningBankVerdict>;
    /**
     * Distill memories from a judged trajectory
     */
    distill(trajectory: Trajectory, verdict: ReasoningBankVerdict, options?: {
        taskId?: string;
        agentId?: string;
    }): Promise<string[]>;
    /**
     * Run consolidation: deduplicate, detect contradictions, prune
     */
    consolidate(): Promise<ConsolidationResult>;
    /**
     * Insert a pattern directly
     */
    insertPattern(pattern: Omit<ReasoningBankPattern, 'createdAt' | 'lastUsed'>): string;
    /**
     * Get a pattern by ID
     */
    getPattern(id: string): ReasoningBankPattern | undefined;
    /**
     * Update pattern confidence
     */
    updateConfidence(id: string, delta: number): void;
    /**
     * Get statistics
     */
    getStats(): {
        totalPatterns: number;
        byDomain: Record<string, number>;
        byOutcome: Record<string, number>;
        avgConfidence: number;
    };
    private cosineSimilarity;
    private mmrSelect;
    private shouldConsolidate;
    private generateJudgmentReasoning;
    private extractPatternsFromTrajectory;
    private computePatternEmbedding;
}
/**
 * Create ReasoningBank adapter
 */
export declare function createReasoningBankAdapter(config?: ReasoningBankConfig): ReasoningBankAdapter;
/**
 * Create default ReasoningBank adapter
 */
export declare function createDefaultReasoningBankAdapter(): ReasoningBankAdapter;
//# sourceMappingURL=reasoningbank-adapter.d.ts.map