/**
 * V3 Task Lifecycle Hooks
 *
 * Provides pre-task and post-task hooks for task execution lifecycle.
 * Integrates with ReasoningBank for learning and pattern recognition.
 *
 * @module v3/shared/hooks/task-hooks
 */
import { HookContext, HookResult } from './types.js';
import { HookRegistry } from './registry.js';
/**
 * Pre-task hook result with agent suggestions
 */
export interface PreTaskHookResult extends HookResult {
    /** Suggested agents for the task */
    suggestedAgents?: AgentSuggestion[];
    /** Task complexity estimation */
    complexity?: 'low' | 'medium' | 'high';
    /** Estimated duration in milliseconds */
    estimatedDuration?: number;
    /** Related patterns from ReasoningBank */
    patterns?: TaskPattern[];
    /** Potential risks */
    risks?: string[];
    /** Recommendations */
    recommendations?: string[];
}
/**
 * Post-task hook result with learning data
 */
export interface PostTaskHookResult extends HookResult {
    /** Task outcome */
    outcome?: TaskOutcome;
    /** Learning updates applied */
    learningUpdates?: LearningUpdate;
    /** Pattern ID if a new pattern was created */
    patternId?: string;
    /** Trajectory ID for ReasoningBank */
    trajectoryId?: string;
}
/**
 * Agent suggestion for task routing
 */
export interface AgentSuggestion {
    /** Agent type */
    type: string;
    /** Confidence score (0-1) */
    confidence: number;
    /** Reason for suggestion */
    reason: string;
    /** Capabilities relevant to this task */
    capabilities?: string[];
}
/**
 * Task pattern from ReasoningBank
 */
export interface TaskPattern {
    /** Pattern identifier */
    id: string;
    /** Pattern description */
    description: string;
    /** Match score (0-1) */
    matchScore: number;
    /** Historical success rate */
    successRate: number;
    /** Average duration in ms */
    avgDuration: number;
    /** Recommended strategies */
    strategies?: string[];
}
/**
 * Task outcome for learning
 */
export interface TaskOutcome {
    /** Whether the task succeeded */
    success: boolean;
    /** Duration in milliseconds */
    duration: number;
    /** Quality score (0-1) */
    quality?: number;
    /** Error details if failed */
    error?: string;
    /** Output artifacts */
    artifacts?: string[];
    /** Agent that executed the task */
    agent?: string;
}
/**
 * Learning update result
 */
export interface LearningUpdate {
    /** Number of patterns updated */
    patternsUpdated: number;
    /** Number of new patterns created */
    newPatterns: number;
    /** Confidence adjustments made */
    confidenceAdjusted: number;
    /** Trajectories recorded */
    trajectoriesRecorded: number;
}
/**
 * Task store for tracking active tasks
 */
interface TaskStore {
    taskId: string;
    description: string;
    startTime: number;
    metadata?: Record<string, unknown>;
    suggestedAgents?: AgentSuggestion[];
}
/**
 * Task Hooks Manager
 *
 * Manages pre-task and post-task hooks with ReasoningBank integration.
 */
export declare class TaskHooksManager {
    private registry;
    private activeTasks;
    private taskPatterns;
    constructor(registry: HookRegistry);
    /**
     * Register default task hooks
     */
    private registerDefaultHooks;
    /**
     * Handle pre-task execution
     */
    handlePreTask(context: HookContext): Promise<PreTaskHookResult>;
    /**
     * Handle post-task execution
     */
    handlePostTask(context: HookContext): Promise<PostTaskHookResult>;
    /**
     * Analyze task for agent suggestions and patterns
     */
    private analyzeTask;
    /**
     * Record learning trajectory
     */
    private recordLearning;
    /**
     * Execute pre-task hook manually
     */
    executePreTask(taskId: string, description: string, metadata?: Record<string, unknown>): Promise<PreTaskHookResult>;
    /**
     * Execute post-task hook manually
     */
    executePostTask(taskId: string, success: boolean, metadata?: Record<string, unknown>): Promise<PostTaskHookResult>;
    /**
     * Get active tasks
     */
    getActiveTasks(): Map<string, TaskStore>;
    /**
     * Clear all active tasks
     */
    clearActiveTasks(): void;
}
/**
 * Create task hooks manager
 */
export declare function createTaskHooksManager(registry: HookRegistry): TaskHooksManager;
export {};
//# sourceMappingURL=task-hooks.d.ts.map