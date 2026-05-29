/**
 * V3 Hook Registry
 *
 * Central registry for hook registration, management, and lookup.
 * Provides priority-based execution ordering and filtering.
 */
import type { HookEvent, HookHandler, HookPriority, HookEntry, HookRegistrationOptions, HookRegistryStats, HookListFilter } from '../types.js';
/**
 * Hook Registry - manages hook registration and lookup
 */
export declare class HookRegistry {
    private hooks;
    private hooksByEvent;
    private stats;
    /**
     * Register a new hook
     */
    register(event: HookEvent, handler: HookHandler, priority: HookPriority, options?: HookRegistrationOptions): string;
    /**
     * Unregister a hook by ID
     */
    unregister(hookId: string): boolean;
    /**
     * Get a hook by ID
     */
    get(hookId: string): HookEntry | undefined;
    /**
     * Get all hooks for an event, sorted by priority (highest first)
     */
    getForEvent(event: HookEvent, enabledOnly?: boolean): HookEntry[];
    /**
     * Enable a hook
     */
    enable(hookId: string): boolean;
    /**
     * Disable a hook
     */
    disable(hookId: string): boolean;
    /**
     * List hooks with optional filtering
     */
    list(filter?: HookListFilter): HookEntry[];
    /**
     * Check if a hook exists
     */
    has(hookId: string): boolean;
    /**
     * Get registry statistics
     */
    getStats(): HookRegistryStats;
    /**
     * Record execution statistics
     */
    recordExecution(success: boolean, duration: number): void;
    /**
     * Clear all hooks
     */
    clear(): void;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Get count of hooks
     */
    get size(): number;
    /**
     * Generate unique hook ID
     */
    private generateId;
}
/**
 * Default global registry instance
 */
export declare const defaultRegistry: HookRegistry;
/**
 * Convenience function to register a hook on the default registry
 */
export declare function registerHook(event: HookEvent, handler: HookHandler, priority: HookPriority, options?: HookRegistrationOptions): string;
/**
 * Convenience function to unregister a hook from the default registry
 */
export declare function unregisterHook(hookId: string): boolean;
export { HookRegistry as default };
//# sourceMappingURL=index.d.ts.map