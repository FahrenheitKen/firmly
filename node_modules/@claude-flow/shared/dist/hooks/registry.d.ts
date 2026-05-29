/**
 * V3 Hooks System - Hook Registry
 *
 * Central registry for managing hook definitions and lifecycle.
 * Provides registration, unregistration, and discovery of hooks.
 *
 * @module v3/shared/hooks/registry
 */
import { HookEvent, HookPriority, HookHandler, HookDefinition, HookStats } from './types.js';
/**
 * Hook registry implementation
 */
export declare class HookRegistry {
    private hooks;
    private hooksById;
    private hookIdCounter;
    private stats;
    /**
     * Register a new hook
     *
     * @param event - Hook event type
     * @param handler - Hook handler function
     * @param priority - Hook priority (default: Normal)
     * @param options - Additional hook options
     * @returns Hook ID for later unregistration
     */
    register(event: HookEvent, handler: HookHandler, priority?: HookPriority, options?: {
        name?: string;
        timeout?: number;
        enabled?: boolean;
        metadata?: Record<string, unknown>;
    }): string;
    /**
     * Unregister a hook by ID
     *
     * @param hookId - Hook ID to unregister
     * @returns Whether hook was found and removed
     */
    unregister(hookId: string): boolean;
    /**
     * Unregister all hooks for an event
     *
     * @param event - Event type to clear hooks for
     * @returns Number of hooks removed
     */
    unregisterAll(event?: HookEvent): number;
    /**
     * Get all hooks for a specific event (sorted by priority)
     *
     * @param event - Event type
     * @param includeDisabled - Whether to include disabled hooks
     * @returns Array of hook definitions
     */
    getHandlers(event: HookEvent, includeDisabled?: boolean): HookDefinition[];
    /**
     * Get a hook by ID
     *
     * @param hookId - Hook ID
     * @returns Hook definition or undefined
     */
    getHook(hookId: string): HookDefinition | undefined;
    /**
     * Enable a hook
     *
     * @param hookId - Hook ID
     * @returns Whether hook was found and enabled
     */
    enable(hookId: string): boolean;
    /**
     * Disable a hook
     *
     * @param hookId - Hook ID
     * @returns Whether hook was found and disabled
     */
    disable(hookId: string): boolean;
    /**
     * List all registered hooks
     *
     * @param filter - Optional filter options
     * @returns Array of hook definitions
     */
    listHooks(filter?: {
        event?: HookEvent;
        enabled?: boolean;
        minPriority?: HookPriority;
    }): HookDefinition[];
    /**
     * Get all event types with registered hooks
     *
     * @returns Array of event types
     */
    getEventTypes(): HookEvent[];
    /**
     * Get count of hooks for an event
     *
     * @param event - Event type (optional)
     * @returns Hook count
     */
    count(event?: HookEvent): number;
    /**
     * Record hook execution statistics
     *
     * @param success - Whether execution succeeded
     * @param executionTime - Execution time in ms
     */
    recordExecution(success: boolean, executionTime: number): void;
    /**
     * Get hook statistics
     *
     * @returns Hook statistics
     */
    getStats(): HookStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Check if a hook exists
     *
     * @param hookId - Hook ID
     * @returns Whether hook exists
     */
    has(hookId: string): boolean;
    /**
     * Clear all hooks and reset state
     */
    clear(): void;
}
/**
 * Create a new hook registry
 */
export declare function createHookRegistry(): HookRegistry;
//# sourceMappingURL=registry.d.ts.map