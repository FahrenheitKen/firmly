/**
 * V3 Hooks System - Main Export
 *
 * Provides extensible hook points for tool execution, file operations,
 * and session lifecycle events. Integrates with event bus for coordination.
 *
 * Example usage:
 *
 * ```typescript
 * import { createHookRegistry, createHookExecutor, HookEvent, HookPriority } from '@claude-flow/shared/hooks';
 *
 * const registry = createHookRegistry();
 * const executor = createHookExecutor(registry, eventBus);
 *
 * // Register a hook
 * const hookId = registry.register(
 *   HookEvent.PreToolUse,
 *   async (context) => {
 *     console.log('Before tool use:', context.tool?.name);
 *     return { success: true };
 *   },
 *   HookPriority.High
 * );
 *
 * // Execute hooks
 * const result = await executor.execute(
 *   HookEvent.PreToolUse,
 *   {
 *     event: HookEvent.PreToolUse,
 *     timestamp: new Date(),
 *     tool: { name: 'Read', parameters: { path: 'file.ts' } }
 *   }
 * );
 *
 * // Unregister hook
 * registry.unregister(hookId);
 * ```
 *
 * @module v3/shared/hooks
 */
export { HookEvent, HookPriority, } from './types.js';
// Export registry
export { HookRegistry, createHookRegistry, } from './registry.js';
export { HookExecutor, createHookExecutor, } from './executor.js';
// Export task hooks
export { TaskHooksManager, createTaskHooksManager, } from './task-hooks.js';
// Export session hooks
export { SessionHooksManager, createSessionHooksManager, InMemorySessionStorage, } from './session-hooks.js';
// Export safety hooks
export { BashSafetyHook, createBashSafetyHook, FileOrganizationHook, createFileOrganizationHook, GitCommitHook, createGitCommitHook, } from './safety/index.js';
//# sourceMappingURL=index.js.map