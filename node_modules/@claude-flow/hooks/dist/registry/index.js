/**
 * V3 Hook Registry
 *
 * Central registry for hook registration, management, and lookup.
 * Provides priority-based execution ordering and filtering.
 */
/**
 * Hook Registry - manages hook registration and lookup
 */
export class HookRegistry {
    hooks = new Map();
    hooksByEvent = new Map();
    stats = {
        totalExecutions: 0,
        totalFailures: 0,
        executionTimes: [],
    };
    /**
     * Register a new hook
     */
    register(event, handler, priority, options = {}) {
        const id = this.generateId();
        const entry = {
            id,
            event,
            handler,
            priority,
            enabled: options.enabled ?? true,
            name: options.name,
            description: options.description,
            registeredAt: new Date(),
            metadata: options.metadata,
        };
        this.hooks.set(id, entry);
        // Index by event
        if (!this.hooksByEvent.has(event)) {
            this.hooksByEvent.set(event, new Set());
        }
        this.hooksByEvent.get(event).add(id);
        return id;
    }
    /**
     * Unregister a hook by ID
     */
    unregister(hookId) {
        const entry = this.hooks.get(hookId);
        if (!entry) {
            return false;
        }
        // Remove from event index
        const eventHooks = this.hooksByEvent.get(entry.event);
        if (eventHooks) {
            eventHooks.delete(hookId);
        }
        this.hooks.delete(hookId);
        return true;
    }
    /**
     * Get a hook by ID
     */
    get(hookId) {
        return this.hooks.get(hookId);
    }
    /**
     * Get all hooks for an event, sorted by priority (highest first)
     */
    getForEvent(event, enabledOnly = true) {
        const hookIds = this.hooksByEvent.get(event);
        if (!hookIds) {
            return [];
        }
        const entries = Array.from(hookIds)
            .map((id) => this.hooks.get(id))
            .filter((entry) => !enabledOnly || entry.enabled);
        // Sort by priority descending (higher priority runs first)
        return entries.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Enable a hook
     */
    enable(hookId) {
        const entry = this.hooks.get(hookId);
        if (!entry) {
            return false;
        }
        entry.enabled = true;
        return true;
    }
    /**
     * Disable a hook
     */
    disable(hookId) {
        const entry = this.hooks.get(hookId);
        if (!entry) {
            return false;
        }
        entry.enabled = false;
        return true;
    }
    /**
     * List hooks with optional filtering
     */
    list(filter) {
        let entries = Array.from(this.hooks.values());
        if (filter) {
            if (filter.event !== undefined) {
                entries = entries.filter((e) => e.event === filter.event);
            }
            if (filter.enabled !== undefined) {
                entries = entries.filter((e) => e.enabled === filter.enabled);
            }
            if (filter.minPriority !== undefined) {
                entries = entries.filter((e) => e.priority >= filter.minPriority);
            }
            if (filter.namePattern) {
                entries = entries.filter((e) => e.name && filter.namePattern.test(e.name));
            }
        }
        return entries.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Check if a hook exists
     */
    has(hookId) {
        return this.hooks.has(hookId);
    }
    /**
     * Get registry statistics
     */
    getStats() {
        const entries = Array.from(this.hooks.values());
        const enabledHooks = entries.filter((e) => e.enabled).length;
        const hooksByEvent = {};
        for (const [event, hooks] of this.hooksByEvent) {
            hooksByEvent[event] = hooks.size;
        }
        const avgExecutionTime = this.stats.executionTimes.length > 0
            ? this.stats.executionTimes.reduce((a, b) => a + b, 0) /
                this.stats.executionTimes.length
            : 0;
        return {
            totalHooks: this.hooks.size,
            enabledHooks,
            disabledHooks: this.hooks.size - enabledHooks,
            hooksByEvent,
            totalExecutions: this.stats.totalExecutions,
            totalFailures: this.stats.totalFailures,
            avgExecutionTime,
        };
    }
    /**
     * Record execution statistics
     */
    recordExecution(success, duration) {
        this.stats.totalExecutions++;
        if (!success) {
            this.stats.totalFailures++;
        }
        this.stats.executionTimes.push(duration);
        // Keep only last 1000 execution times
        if (this.stats.executionTimes.length > 1000) {
            this.stats.executionTimes = this.stats.executionTimes.slice(-1000);
        }
    }
    /**
     * Clear all hooks
     */
    clear() {
        this.hooks.clear();
        this.hooksByEvent.clear();
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalExecutions: 0,
            totalFailures: 0,
            executionTimes: [],
        };
    }
    /**
     * Get count of hooks
     */
    get size() {
        return this.hooks.size;
    }
    /**
     * Generate unique hook ID
     */
    generateId() {
        return `hook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
}
/**
 * Default global registry instance
 */
export const defaultRegistry = new HookRegistry();
/**
 * Convenience function to register a hook on the default registry
 */
export function registerHook(event, handler, priority, options) {
    return defaultRegistry.register(event, handler, priority, options);
}
/**
 * Convenience function to unregister a hook from the default registry
 */
export function unregisterHook(hookId) {
    return defaultRegistry.unregister(hookId);
}
export { HookRegistry as default };
//# sourceMappingURL=index.js.map