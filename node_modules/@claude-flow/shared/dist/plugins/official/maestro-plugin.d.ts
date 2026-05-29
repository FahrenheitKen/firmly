/**
 * Maestro Plugin - Official Plugin (ADR-004)
 *
 * Implements orchestration patterns for complex multi-agent workflows.
 * Part of the official plugin collection.
 *
 * @module v3/shared/plugins/official/maestro
 */
import type { ClaudeFlowPlugin, PluginContext, PluginConfig } from '../types.js';
/**
 * Maestro configuration
 */
export interface MaestroConfig extends PluginConfig {
    orchestrationMode: 'sequential' | 'parallel' | 'adaptive';
    maxConcurrentWorkflows: number;
    workflowTimeout: number;
    autoRecovery: boolean;
    checkpointInterval: number;
}
/**
 * Workflow step
 */
export interface WorkflowStep {
    id: string;
    name: string;
    type: string;
    input: Record<string, unknown>;
    dependencies: string[];
    assignedAgent?: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    output?: unknown;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
}
/**
 * Workflow definition
 */
export interface Workflow {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
    currentStep?: string;
    progress: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    checkpoints: Map<string, unknown>;
}
/**
 * Orchestration result
 */
export interface OrchestrationResult {
    workflowId: string;
    success: boolean;
    stepsCompleted: number;
    stepsTotal: number;
    outputs: Record<string, unknown>;
    errors: Array<{
        stepId: string;
        error: string;
    }>;
    duration: number;
}
/**
 * Maestro Plugin Implementation
 */
export declare class MaestroPlugin implements ClaudeFlowPlugin {
    readonly id = "maestro";
    readonly name = "Maestro Workflow Orchestrator";
    readonly version = "1.0.0";
    readonly description = "Complex multi-agent workflow orchestration with adaptive strategies";
    private context?;
    private config;
    private workflows;
    private activeWorkflows;
    constructor(config?: Partial<MaestroConfig>);
    initialize(context: PluginContext): Promise<void>;
    shutdown(): Promise<void>;
    /**
     * Create a new workflow
     */
    createWorkflow(name: string, description: string, steps: Array<Omit<WorkflowStep, 'id' | 'status'>>): Workflow;
    /**
     * Execute a workflow
     */
    executeWorkflow(workflowId: string): Promise<OrchestrationResult>;
    /**
     * Pause a workflow
     */
    pauseWorkflow(workflowId: string): boolean;
    /**
     * Resume a paused workflow
     */
    resumeWorkflow(workflowId: string): Promise<OrchestrationResult>;
    /**
     * Get workflow status
     */
    getWorkflow(workflowId: string): Workflow | undefined;
    /**
     * List all workflows
     */
    listWorkflows(): Workflow[];
    private executeSequential;
    private executeParallel;
    private executeAdaptive;
    private executeStep;
    private buildExecutionLayers;
    private resolveInputReferences;
    private updateProgress;
    private updateWorkflowProgress;
    private handleWorkflowError;
    private checkpointWorkflow;
}
/**
 * Factory function
 */
export declare function createMaestroPlugin(config?: Partial<MaestroConfig>): MaestroPlugin;
//# sourceMappingURL=maestro-plugin.d.ts.map