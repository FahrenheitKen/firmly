/**
 * V3 Hooks System - Hook Executor
 *
 * Executes hooks in priority order with timeout handling and error recovery.
 * Integrates with event bus for coordination and monitoring.
 *
 * @module v3/shared/hooks/executor
 */
import type { IEventBus } from '../core/interfaces/event.interface.js';
import { HookRegistry } from './registry.js';
import { HookEvent, HookContext, HookResult, HookExecutionOptions } from './types.js';
/**
 * Hook execution result aggregation
 */
export interface AggregatedHookResult {
    /** Whether all hooks succeeded */
    success: boolean;
    /** Individual hook results */
    results: HookResult[];
    /** Total execution time in ms */
    totalExecutionTime: number;
    /** Number of hooks executed */
    hooksExecuted: number;
    /** Number of hooks failed */
    hooksFailed: number;
    /** Whether operation was aborted */
    aborted: boolean;
    /** Final merged context (from all hooks) */
    finalContext?: Partial<HookContext>;
}
/**
 * Hook executor implementation
 */
export declare class HookExecutor {
    private registry;
    private eventBus?;
    constructor(registry: HookRegistry, eventBus?: IEventBus);
    /**
     * Execute all hooks for an event
     *
     * @param event - Hook event type
     * @param context - Hook context
     * @param options - Execution options
     * @returns Aggregated results
     */
    execute(event: HookEvent, context: HookContext, options?: HookExecutionOptions): Promise<AggregatedHookResult>;
    /**
     * Execute hooks with timeout
     *
     * @param event - Hook event type
     * @param context - Hook context
     * @param timeout - Timeout in ms
     * @returns Aggregated results
     */
    executeWithTimeout(event: HookEvent, context: HookContext, timeout: number): Promise<AggregatedHookResult>;
    /**
     * Execute a single hook with timeout and error handling
     *
     * @param handler - Hook handler function
     * @param context - Hook context
     * @param timeout - Optional timeout in ms
     * @returns Hook result
     */
    private executeSingleHook;
    /**
     * Execute multiple hooks in parallel
     *
     * @param events - Array of hook events
     * @param contexts - Array of contexts (matched by index)
     * @param options - Execution options
     * @returns Array of aggregated results
     */
    executeParallel(events: HookEvent[], contexts: HookContext[], options?: HookExecutionOptions): Promise<AggregatedHookResult[]>;
    /**
     * Execute hooks sequentially with context chaining
     *
     * @param events - Array of hook events
     * @param initialContext - Initial context
     * @param options - Execution options
     * @returns Final aggregated result with chained context
     */
    executeSequential(events: HookEvent[], initialContext: HookContext, options?: HookExecutionOptions): Promise<AggregatedHookResult>;
    /**
     * Wrap a promise with timeout
     */
    private withTimeout;
    /**
     * Set event bus for coordination
     */
    setEventBus(eventBus: IEventBus): void;
    /**
     * Get hook registry
     */
    getRegistry(): HookRegistry;
}
/**
 * Create a new hook executor
 */
export declare function createHookExecutor(registry: HookRegistry, eventBus?: IEventBus): HookExecutor;
//# sourceMappingURL=executor.d.ts.map