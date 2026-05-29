/**
 * Learning Domain Service - Domain Layer
 *
 * Contains learning logic for pattern recognition and optimization.
 *
 * @module v3/neural/domain/services
 */
import { Pattern, PatternType } from '../entities/pattern.js';
/**
 * Learning trajectory
 */
export interface Trajectory {
    id: string;
    input: string;
    actions: string[];
    outcome: 'success' | 'failure' | 'partial';
    reward: number;
    metadata?: Record<string, unknown>;
    timestamp: Date;
}
/**
 * Learning result
 */
export interface LearningResult {
    patternsExtracted: number;
    patternsUpdated: number;
    confidenceChange: number;
}
/**
 * Route recommendation
 */
export interface RouteRecommendation {
    agentRole: string;
    confidence: number;
    reasoning: string;
    alternates: Array<{
        role: string;
        confidence: number;
    }>;
}
/**
 * Learning Domain Service
 */
export declare class LearningDomainService {
    private patterns;
    /**
     * Extract patterns from trajectory
     */
    extractPatterns(trajectory: Trajectory): Pattern[];
    /**
     * Update patterns based on trajectory outcome
     */
    updatePatterns(trajectory: Trajectory): LearningResult;
    /**
     * Get route recommendation for task
     */
    getRouteRecommendation(taskDescription: string): RouteRecommendation;
    /**
     * Get default recommendation based on keywords
     */
    private getDefaultRecommendation;
    /**
     * Extract condition from input
     */
    private extractCondition;
    /**
     * Consolidate patterns (merge duplicates, prune low-confidence)
     */
    consolidate(minConfidence?: number): {
        merged: number;
        pruned: number;
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
     * Add pattern
     */
    addPattern(pattern: Pattern): void;
    /**
     * Remove pattern
     */
    removePattern(id: string): boolean;
}
//# sourceMappingURL=learning-service.d.ts.map