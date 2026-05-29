/**
 * V3 Hooks System - Hook Executor
 *
 * Executes hooks in priority order with timeout handling and error recovery.
 * Integrates with event bus for coordination and monitoring.
 *
 * @module v3/shared/hooks/executor
 */
/**
 * Hook executor implementation
 */
export class HookExecutor {
    registry;
    eventBus;
    constructor(registry, eventBus) {
        this.registry = registry;
        this.eventBus = eventBus;
    }
    /**
     * Execute all hooks for an event
     *
     * @param event - Hook event type
     * @param context - Hook context
     * @param options - Execution options
     * @returns Aggregated results
     */
    async execute(event, context, options = {}) {
        const startTime = Date.now();
        const results = [];
        let aborted = false;
        let finalContext = {};
        // Get enabled hooks for this event
        const hooks = this.registry.getHandlers(event, false);
        // Emit pre-execution event
        this.eventBus?.emit('hooks:pre-execute', {
            event,
            hookCount: hooks.length,
            context,
        });
        // Execute hooks in priority order
        for (const hook of hooks) {
            if (aborted) {
                break;
            }
            try {
                const result = await this.executeSingleHook(hook.handler, context, hook.timeout || options.timeout);
                results.push(result);
                // Record execution statistics
                this.registry.recordExecution(result.success, result.executionTime || 0);
                // Merge context modifications
                if (result.data) {
                    finalContext = { ...finalContext, ...result.data };
                    // Update context for next hooks
                    Object.assign(context, result.data);
                }
                // Check if we should abort
                if (result.abort) {
                    aborted = true;
                    break;
                }
                // Check if we should stop the chain
                if (result.continueChain === false) {
                    break;
                }
                // Check if we should stop on error
                if (!result.success && !options.continueOnError) {
                    aborted = true;
                    break;
                }
            }
            catch (error) {
                const errorResult = {
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    continueChain: options.continueOnError,
                };
                results.push(errorResult);
                this.registry.recordExecution(false, 0);
                // Emit error event
                this.eventBus?.emit('hooks:error', {
                    event,
                    hookId: hook.id,
                    error,
                });
                if (!options.continueOnError) {
                    aborted = true;
                    break;
                }
            }
        }
        const totalExecutionTime = Date.now() - startTime;
        const hooksFailed = results.filter(r => !r.success).length;
        // Build aggregated result
        const aggregatedResult = {
            success: hooksFailed === 0 && !aborted,
            results: options.collectResults ? results : [],
            totalExecutionTime,
            hooksExecuted: results.length,
            hooksFailed,
            aborted,
            finalContext,
        };
        // Emit post-execution event
        this.eventBus?.emit('hooks:post-execute', {
            event,
            ...aggregatedResult,
        });
        return aggregatedResult;
    }
    /**
     * Execute hooks with timeout
     *
     * @param event - Hook event type
     * @param context - Hook context
     * @param timeout - Timeout in ms
     * @returns Aggregated results
     */
    async executeWithTimeout(event, context, timeout) {
        return this.withTimeout(this.execute(event, context, { timeout }), timeout);
    }
    /**
     * Execute a single hook with timeout and error handling
     *
     * @param handler - Hook handler function
     * @param context - Hook context
     * @param timeout - Optional timeout in ms
     * @returns Hook result
     */
    async executeSingleHook(handler, context, timeout) {
        const startTime = Date.now();
        try {
            let resultPromise = Promise.resolve(handler(context));
            // Apply timeout if specified
            if (timeout && timeout > 0) {
                resultPromise = this.withTimeout(resultPromise, timeout);
            }
            const result = await resultPromise;
            const executionTime = Date.now() - startTime;
            return {
                ...result,
                executionTime,
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                executionTime,
            };
        }
    }
    /**
     * Execute multiple hooks in parallel
     *
     * @param events - Array of hook events
     * @param contexts - Array of contexts (matched by index)
     * @param options - Execution options
     * @returns Array of aggregated results
     */
    async executeParallel(events, contexts, options = {}) {
        if (events.length !== contexts.length) {
            throw new Error('Events and contexts arrays must have same length');
        }
        const maxParallel = options.maxParallel || events.length;
        const results = [];
        // Execute in batches
        for (let i = 0; i < events.length; i += maxParallel) {
            const batch = events.slice(i, i + maxParallel);
            const batchContexts = contexts.slice(i, i + maxParallel);
            const batchResults = await Promise.allSettled(batch.map((event, index) => this.execute(event, batchContexts[index], options)));
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                }
                else {
                    // Create error result for rejected promises
                    results.push({
                        success: false,
                        results: [{
                                success: false,
                                error: result.reason instanceof Error
                                    ? result.reason
                                    : new Error(String(result.reason)),
                            }],
                        totalExecutionTime: 0,
                        hooksExecuted: 0,
                        hooksFailed: 1,
                        aborted: true,
                    });
                }
            }
        }
        return results;
    }
    /**
     * Execute hooks sequentially with context chaining
     *
     * @param events - Array of hook events
     * @param initialContext - Initial context
     * @param options - Execution options
     * @returns Final aggregated result with chained context
     */
    async executeSequential(events, initialContext, options = {}) {
        const results = [];
        let currentContext = { ...initialContext };
        let totalExecutionTime = 0;
        let totalHooksExecuted = 0;
        let totalHooksFailed = 0;
        let aborted = false;
        for (const event of events) {
            if (aborted) {
                break;
            }
            const result = await this.execute(event, currentContext, options);
            results.push(...result.results);
            totalExecutionTime += result.totalExecutionTime;
            totalHooksExecuted += result.hooksExecuted;
            totalHooksFailed += result.hooksFailed;
            // Merge context for next event
            if (result.finalContext) {
                currentContext = { ...currentContext, ...result.finalContext };
            }
            if (result.aborted || !result.success) {
                aborted = true;
                break;
            }
        }
        return {
            success: totalHooksFailed === 0 && !aborted,
            results: options.collectResults ? results : [],
            totalExecutionTime,
            hooksExecuted: totalHooksExecuted,
            hooksFailed: totalHooksFailed,
            aborted,
            finalContext: currentContext,
        };
    }
    /**
     * Wrap a promise with timeout
     */
    async withTimeout(promise, timeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Hook execution timeout after ${timeout}ms`)), timeout)),
        ]);
    }
    /**
     * Set event bus for coordination
     */
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }
    /**
     * Get hook registry
     */
    getRegistry() {
        return this.registry;
    }
}
/**
 * Create a new hook executor
 */
export function createHookExecutor(registry, eventBus) {
    return new HookExecutor(registry, eventBus);
}
//# sourceMappingURL=executor.js.map