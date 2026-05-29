/**
 * Neural Application Service - Application Layer
 *
 * Orchestrates neural learning operations.
 *
 * @module v3/neural/application/services
 */
import { Pattern, PatternType } from '../../domain/entities/pattern.js';
import { Trajectory, LearningResult, RouteRecommendation } from '../../domain/services/learning-service.js';
/**
 * Training session result
 */
export interface TrainingSessionResult {
    trajectoriesProcessed: number;
    patternsExtracted: number;
    patternsUpdated: number;
    averageConfidenceChange: number;
    duration: number;
}
/**
 * Neural metrics
 */
export interface NeuralMetrics {
    totalPatterns: number;
    patternsByType: Record<PatternType, number>;
    averageConfidence: number;
    reliablePatterns: number;
    totalSuccesses: number;
    totalFailures: number;
}
/**
 * Neural Application Service
 */
export declare class NeuralApplicationService {
    private readonly learningService;
    constructor();
    /**
     * Learn from a single trajectory
     */
    learn(trajectory: Trajectory): LearningResult;
    /**
     * Train on batch of trajectories
     */
    train(trajectories: Trajectory[]): TrainingSessionResult;
    /**
     * Get route recommendation for task
     */
    route(taskDescription: string): RouteRecommendation;
    /**
     * Explain routing decision
     */
    explain(taskDescription: string): {
        recommendation: RouteRecommendation;
        matchingPatterns: Pattern[];
        reasoning: string[];
    };
    /**
     * Get all patterns
     */
    getPatterns(): Pattern[];
    /**
     * Get patterns by type
     */
    getPatternsByType(type: PatternType): Pattern[];
    /**
     * Add custom pattern
     */
    addPattern(props: {
        type: PatternType;
        name: string;
        description: string;
        condition: string;
        action: string;
        confidence?: number;
    }): Pattern;
    /**
     * Remove pattern
     */
    removePattern(id: string): boolean;
    /**
     * Consolidate patterns
     */
    consolidate(minConfidence?: number): {
        merged: number;
        pruned: number;
    };
    /**
     * Get neural metrics
     */
    getMetrics(): NeuralMetrics;
}
//# sourceMappingURL=neural-application-service.d.ts.map