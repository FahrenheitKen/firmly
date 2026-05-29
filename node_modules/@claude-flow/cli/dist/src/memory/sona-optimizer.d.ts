/**
 * SONA (Self-Optimizing Neural Architecture) Optimizer
 *
 * Processes trajectory outcomes to learn optimal routing patterns.
 * Integrates with Q-learning router and persistence layer.
 *
 * Features:
 * - Processes trajectory outcomes from hooksTrajectoryEnd
 * - Extracts keywords from tasks for pattern matching
 * - Maintains learned routing patterns with confidence scoring
 * - Persists patterns to .swarm/sona-patterns.json
 * - Integrates with Q-learning router for combined routing
 *
 * @module v3/cli/memory/sona-optimizer
 */
/**
 * Trajectory outcome from hooks/intelligence/trajectory-end
 */
export interface TrajectoryOutcome {
    trajectoryId: string;
    task: string;
    agent: string;
    success: boolean;
    steps?: Array<{
        action: string;
        result: string;
        quality: number;
        timestamp: string;
    }>;
    feedback?: string;
    duration?: number;
}
/**
 * Learned routing pattern
 */
export interface LearnedPattern {
    /** Keywords extracted from task descriptions */
    keywords: string[];
    /** Agent that handled the task */
    agent: string;
    /** Confidence score (0-1) */
    confidence: number;
    /** Number of successful uses */
    successCount: number;
    /** Number of failed uses */
    failureCount: number;
    /** Last time pattern was used */
    lastUsed: number;
    /** Pattern creation time */
    createdAt: number;
}
/**
 * Routing suggestion result
 */
export interface RoutingSuggestion {
    /** Recommended agent */
    agent: string;
    /** Confidence in recommendation (0-1) */
    confidence: number;
    /** Whether Q-learning was used */
    usedQLearning: boolean;
    /** Source of recommendation */
    source: 'sona-native' | 'sona-pattern' | 'q-learning' | 'sona-keyword' | 'default';
    /** Alternative agents with scores */
    alternatives: Array<{
        agent: string;
        score: number;
    }>;
    /** Matched keywords */
    matchedKeywords?: string[];
}
/**
 * SONA optimizer statistics
 */
export interface SONAStats {
    /** Total patterns learned */
    totalPatterns: number;
    /** Successful routing decisions */
    successfulRoutings: number;
    /** Failed routing decisions */
    failedRoutings: number;
    /** Total trajectories processed */
    trajectoriesProcessed: number;
    /** Average confidence of patterns */
    avgConfidence: number;
    /** Q-learning integration status */
    qLearningEnabled: boolean;
    /** Time of last learning update */
    lastUpdate: number | null;
    /** Contrastive trainer status (from @ruvector/ruvllm) */
    _contrastiveTrainer?: {
        triplets: number;
        agents: number;
    } | 'unavailable';
}
/**
 * SONA Optimizer for adaptive routing based on trajectory outcomes
 *
 * Learns from past task outcomes to improve future routing decisions.
 * Integrates with Q-learning router for hybrid routing strategy.
 */
export declare class SONAOptimizer {
    private patterns;
    private trajectoriesProcessed;
    private successfulRoutings;
    private failedRoutings;
    private lastUpdate;
    private persistencePath;
    private qLearningRouter;
    private qLearningEnabled;
    /** Real @ruvector/sona engine — null if native not available, undefined if not yet tried */
    private sonaEngine;
    constructor(options?: {
        persistencePath?: string;
    });
    /**
     * Attempt to load the native @ruvector/sona engine (once).
     * Sets `sonaEngine` to the engine instance or null if unavailable.
     */
    private loadSonaEngine;
    /**
     * Infer an agent type string from a SONA pattern result object.
     */
    private inferAgentFromPattern;
    /**
     * Initialize the optimizer and load persisted state
     */
    initialize(): Promise<{
        success: boolean;
        patternsLoaded: number;
    }>;
    /**
     * Process a trajectory outcome and learn from it
     * Called by hooksTrajectoryEnd
     */
    processTrajectoryOutcome(outcome: TrajectoryOutcome): {
        learned: boolean;
        patternKey: string;
        confidence: number;
        keywordsExtracted: string[];
    };
    /**
     * Get routing suggestion based on learned patterns.
     *
     * Priority order:
     * 1. Real @ruvector/sona native engine (if available and has matches)
     * 2. SONA learned pattern matching (keyword overlap + confidence)
     * 3. Q-learning router (if enabled)
     * 4. Keyword heuristic
     * 5. Default fallback
     */
    getRoutingSuggestion(task: string): Promise<RoutingSuggestion>;
    /**
     * Get optimizer statistics
     */
    getStats(): SONAStats;
    /**
     * Trigger contrastive training on accumulated agent embeddings.
     * Returns training metrics or { trained: false } if insufficient data.
     *
     * @param _epochs - reserved for future use (epochs are set at ContrastiveTrainer construction)
     */
    trainAgentEmbeddings(_epochs?: number): Promise<{
        trained: boolean;
        loss?: number;
        triplets?: number;
    }>;
    /**
     * Apply temporal decay to pattern confidence
     * Reduces confidence of unused patterns
     */
    applyTemporalDecay(): number;
    /**
     * Reset all learned patterns
     */
    reset(): void;
    /**
     * Export patterns for analysis
     */
    exportPatterns(): Record<string, LearnedPattern>;
    /**
     * Import patterns (for migration or testing)
     */
    importPatterns(patterns: Record<string, LearnedPattern>): number;
    /**
     * Convert extracted keywords into a lightweight 384-dim embedding proxy.
     * Uses a deterministic hash-scatter so each keyword set maps to a
     * consistent unit-length vector compatible with ContrastiveTrainer.
     */
    private keywordsToEmbedding;
    /**
     * Extract meaningful keywords from task description
     */
    private extractKeywords;
    /**
     * Check if word is a stop word
     */
    private isStopWord;
    /**
     * Create a unique pattern key from keywords and agent
     */
    private createPatternKey;
    /**
     * Find the best matching pattern for given keywords
     */
    private findBestPatternMatch;
    /**
     * Match keywords to agent using category heuristics
     */
    private matchKeywordsToAgent;
    /**
     * Get alternative agent suggestions
     */
    private getAlternatives;
    /**
     * Prune old/low-confidence patterns if over limit
     */
    private prunePatterns;
    /**
     * Validate pattern structure
     */
    private validatePattern;
    /**
     * Load patterns from disk
     */
    private loadFromDisk;
    /**
     * Save patterns to disk
     */
    private saveToDisk;
}
/**
 * Get the singleton SONAOptimizer instance
 * Uses lazy initialization to avoid circular imports
 */
export declare function getSONAOptimizer(): Promise<SONAOptimizer>;
/**
 * Reset the singleton instance (for testing)
 */
export declare function resetSONAOptimizer(): void;
/**
 * Process a trajectory outcome (convenience function)
 */
export declare function processTrajectory(outcome: TrajectoryOutcome): Promise<{
    learned: boolean;
    patternKey: string;
    confidence: number;
    keywordsExtracted: string[];
}>;
/**
 * Get routing suggestion (convenience function)
 */
export declare function getSuggestion(task: string): Promise<RoutingSuggestion>;
/**
 * Get SONA statistics (convenience function)
 */
export declare function getSONAStats(): Promise<SONAStats>;
declare const _default: {
    SONAOptimizer: typeof SONAOptimizer;
    getSONAOptimizer: typeof getSONAOptimizer;
    resetSONAOptimizer: typeof resetSONAOptimizer;
    processTrajectory: typeof processTrajectory;
    getSuggestion: typeof getSuggestion;
    getSONAStats: typeof getSONAStats;
};
export default _default;
//# sourceMappingURL=sona-optimizer.d.ts.map