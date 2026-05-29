/**
 * V3 Hook Executor
 *
 * Executes hooks in priority order with timeout handling,
 * error recovery, and result aggregation.
 */
import type { HookEvent, HookContext, HookExecutionOptions, HookExecutionResult } from '../types.js';
import { HookRegistry } from '../registry/index.js';
/**
 * Hook Executor - executes hooks for events
 */
export declare class HookExecutor {
    private registry;
    private eventEmitter?;
    constructor(registry?: HookRegistry);
    /**
     * Set event emitter for hook execution events
     */
    setEventEmitter(emitter: {
        emit: (event: string, data: unknown) => void;
    }): void;
    /**
     * Execute all hooks for an event
     */
    execute<T = unknown>(event: HookEvent, context: Partial<HookContext<T>>, options?: HookExecutionOptions): Promise<HookExecutionResult>;
    /**
     * Execute a single hook with timeout
     */
    private executeWithTimeout;
    /**
     * Execute hooks for pre-tool-use event
     */
    preToolUse(toolName: string, parameters: Record<string, unknown>, options?: HookExecutionOptions): Promise<HookExecutionResult>;
    /**
     * Execute hooks for post-tool-use event
     */
    postToolUse(toolName: string, parameters: Record<string, unknown>, duration: number, options?: HookExecutionOptions): Promise<HookExecutionResult>;
    /**
     * Execute hooks for pre-edit event
     */
    preEdit(filePath: string, operation: 'create' | 'modify' | 'delete', options?: HookExecutionOptions): Promise<HookExecutionResult>;
    /**
     * Execute hooks for post-edit event
     */
    postEdit(filePath: string, operation: 'create' | 'modify' | 'delete', duration: number, options?: HookExecutionOptions): Promise<HookExecutionResult>;
    /**
     * Execute hooks for pre-command event
     */
    preCommand(command: string, workingDirectory?: string, options?: HookExecutionOptions): Promise<HookExecutionResult>;
    /**
     * Execute hooks for post-command event
     */
    postCommand(command: string, exitCode: number, output?: string, error?: string, options?: HookExecutionOptions): Promise<HookExecutionResult>;
    /**
     * Execute hooks for session-start event
     */
    sessionStart(sessionId: string, options?: HookExecutionOptions): Promise<HookExecutionResult>;
    /**
     * Execute hooks for session-end event
     */
    sessionEnd(sessionId: string, options?: HookExecutionOptions): Promise<HookExecutionResult>;
    /**
     * Execute hooks for agent-spawn event
     */
    agentSpawn(agentId: string, agentType: string, options?: HookExecutionOptions): Promise<HookExecutionResult>;
    /**
     * Execute hooks for agent-terminate event
     */
    agentTerminate(agentId: string, agentType: string, status: string, options?: HookExecutionOptions): Promise<HookExecutionResult>;
}
/**
 * Default global executor instance
 */
export declare const defaultExecutor: HookExecutor;
/**
 * Convenience function to execute hooks on the default executor
 */
export declare function executeHooks<T = unknown>(event: HookEvent, context: Partial<HookContext<T>>, options?: HookExecutionOptions): Promise<HookExecutionResult>;
export { HookExecutor as default };
//# sourceMappingURL=index.d.ts.map