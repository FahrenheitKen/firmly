/**
 * V3 Hook Executor
 *
 * Executes hooks in priority order with timeout handling,
 * error recovery, and result aggregation.
 */
import { defaultRegistry } from '../registry/index.js';
/**
 * Default execution options
 */
const DEFAULT_OPTIONS = {
    continueOnError: false,
    timeout: 5000,
    emitEvents: true,
};
/**
 * Hook Executor - executes hooks for events
 */
export class HookExecutor {
    registry;
    eventEmitter;
    constructor(registry) {
        this.registry = registry ?? defaultRegistry;
    }
    /**
     * Set event emitter for hook execution events
     */
    setEventEmitter(emitter) {
        this.eventEmitter = emitter;
    }
    /**
     * Execute all hooks for an event
     */
    async execute(event, context, options) {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const startTime = Date.now();
        // Build full context
        const fullContext = {
            event,
            timestamp: new Date(),
            ...context,
        };
        // Get hooks for event
        const hooks = this.registry.getForEvent(event, true);
        if (hooks.length === 0) {
            return {
                success: true,
                hooksExecuted: 0,
                hooksFailed: 0,
                executionTime: Date.now() - startTime,
                results: [],
                finalContext: fullContext,
            };
        }
        // Execute hooks in priority order
        const results = [];
        const warnings = [];
        const messages = [];
        let aborted = false;
        let hooksFailed = 0;
        for (const hook of hooks) {
            if (aborted)
                break;
            const hookStart = Date.now();
            let result;
            try {
                result = await this.executeWithTimeout(hook, fullContext, opts.timeout);
            }
            catch (error) {
                result = {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
            const hookDuration = Date.now() - hookStart;
            results.push({
                hookId: hook.id,
                hookName: hook.name,
                success: result.success,
                duration: hookDuration,
                error: result.error,
            });
            // Collect warnings and messages
            if (result.warnings) {
                warnings.push(...result.warnings);
            }
            if (result.message) {
                messages.push(result.message);
            }
            // Update context with hook data
            if (result.data) {
                Object.assign(fullContext, { metadata: { ...fullContext.metadata, ...result.data } });
            }
            // Record stats
            this.registry.recordExecution(result.success, hookDuration);
            // Handle failure
            if (!result.success) {
                hooksFailed++;
                if (opts.emitEvents && this.eventEmitter) {
                    this.eventEmitter.emit('hook:failed', {
                        hookId: hook.id,
                        hookName: hook.name,
                        event,
                        error: result.error,
                    });
                }
                if (!opts.continueOnError) {
                    aborted = true;
                    break;
                }
            }
            // Handle abort request
            if (result.abort) {
                aborted = true;
                break;
            }
            // Emit success event
            if (opts.emitEvents && this.eventEmitter && result.success) {
                this.eventEmitter.emit('hook:executed', {
                    hookId: hook.id,
                    hookName: hook.name,
                    event,
                    duration: hookDuration,
                });
            }
        }
        const executionTime = Date.now() - startTime;
        // Emit completion event
        if (opts.emitEvents && this.eventEmitter) {
            this.eventEmitter.emit('hooks:completed', {
                event,
                hooksExecuted: results.length,
                hooksFailed,
                executionTime,
                aborted,
            });
        }
        return {
            success: hooksFailed === 0 && !aborted,
            aborted,
            hooksExecuted: results.length,
            hooksFailed,
            executionTime,
            results,
            finalContext: fullContext,
            warnings: warnings.length > 0 ? warnings : undefined,
            messages: messages.length > 0 ? messages : undefined,
        };
    }
    /**
     * Execute a single hook with timeout
     */
    async executeWithTimeout(hook, context, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Hook ${hook.id} timed out after ${timeout}ms`));
            }, timeout);
            Promise.resolve(hook.handler(context))
                .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    /**
     * Execute hooks for pre-tool-use event
     */
    async preToolUse(toolName, parameters, options) {
        const { HookEvent } = await import('../types.js');
        return this.execute(HookEvent.PreToolUse, {
            tool: { name: toolName, parameters },
        }, options);
    }
    /**
     * Execute hooks for post-tool-use event
     */
    async postToolUse(toolName, parameters, duration, options) {
        const { HookEvent } = await import('../types.js');
        return this.execute(HookEvent.PostToolUse, {
            tool: { name: toolName, parameters },
            duration,
        }, options);
    }
    /**
     * Execute hooks for pre-edit event
     */
    async preEdit(filePath, operation, options) {
        const { HookEvent } = await import('../types.js');
        return this.execute(HookEvent.PreEdit, {
            file: { path: filePath, operation },
        }, options);
    }
    /**
     * Execute hooks for post-edit event
     */
    async postEdit(filePath, operation, duration, options) {
        const { HookEvent } = await import('../types.js');
        return this.execute(HookEvent.PostEdit, {
            file: { path: filePath, operation },
            duration,
        }, options);
    }
    /**
     * Execute hooks for pre-command event
     */
    async preCommand(command, workingDirectory, options) {
        const { HookEvent } = await import('../types.js');
        return this.execute(HookEvent.PreCommand, {
            command: { raw: command, workingDirectory },
        }, options);
    }
    /**
     * Execute hooks for post-command event
     */
    async postCommand(command, exitCode, output, error, options) {
        const { HookEvent } = await import('../types.js');
        return this.execute(HookEvent.PostCommand, {
            command: { raw: command, exitCode, output, error },
        }, options);
    }
    /**
     * Execute hooks for session-start event
     */
    async sessionStart(sessionId, options) {
        const { HookEvent } = await import('../types.js');
        return this.execute(HookEvent.SessionStart, {
            session: { id: sessionId, startedAt: new Date() },
        }, options);
    }
    /**
     * Execute hooks for session-end event
     */
    async sessionEnd(sessionId, options) {
        const { HookEvent } = await import('../types.js');
        return this.execute(HookEvent.SessionEnd, {
            session: { id: sessionId, startedAt: new Date() },
        }, options);
    }
    /**
     * Execute hooks for agent-spawn event
     */
    async agentSpawn(agentId, agentType, options) {
        const { HookEvent } = await import('../types.js');
        return this.execute(HookEvent.AgentSpawn, {
            agent: { id: agentId, type: agentType },
        }, options);
    }
    /**
     * Execute hooks for agent-terminate event
     */
    async agentTerminate(agentId, agentType, status, options) {
        const { HookEvent } = await import('../types.js');
        return this.execute(HookEvent.AgentTerminate, {
            agent: { id: agentId, type: agentType, status },
        }, options);
    }
}
/**
 * Default global executor instance
 */
export const defaultExecutor = new HookExecutor();
/**
 * Convenience function to execute hooks on the default executor
 */
export async function executeHooks(event, context, options) {
    return defaultExecutor.execute(event, context, options);
}
export { HookExecutor as default };
//# sourceMappingURL=index.js.map