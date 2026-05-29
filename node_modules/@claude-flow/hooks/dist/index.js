/**
 * @claude-flow/hooks - V3 Hooks System
 *
 * Event-driven lifecycle hooks with ReasoningBank learning integration.
 *
 * Features:
 * - Hook registration and execution
 * - Background daemons for metrics and learning
 * - Statusline integration
 * - MCP tool definitions
 * - V2 compatibility layer
 *
 * @packageDocumentation
 */
// Types
export * from './types.js';
// ReasoningBank - Vector-based pattern learning
export { ReasoningBank, reasoningBank, } from './reasoningbank/index.js';
// Guidance Provider - Claude-visible output generation
export { GuidanceProvider, guidanceProvider, } from './reasoningbank/guidance-provider.js';
// Registry
export { HookRegistry, defaultRegistry, registerHook, unregisterHook, } from './registry/index.js';
// Executor
export { HookExecutor, defaultExecutor, executeHooks, } from './executor/index.js';
// Daemons
export { DaemonManager, MetricsDaemon, SwarmMonitorDaemon, HooksLearningDaemon, defaultDaemonManager, } from './daemons/index.js';
// Statusline
export { StatuslineGenerator, createShellStatusline, parseStatuslineData, defaultStatuslineGenerator, } from './statusline/index.js';
// MCP Tools
export { hooksMCPTools, getHooksTool, preEditTool, postEditTool, routeTaskTool, metricsTool, preCommandTool, postCommandTool, daemonStatusTool, statuslineTool, } from './mcp/index.js';
// Official Claude Code Hooks Bridge
export { OfficialHooksBridge, V3_TO_OFFICIAL_HOOK_MAP, V3_TOOL_MATCHERS, processOfficialHookInput, outputOfficialHookResult, executeWithBridge, } from './bridge/official-hooks-bridge.js';
// Swarm Communication
export { SwarmCommunication, swarmComm, } from './swarm/index.js';
// Workers - Cross-platform background workers
export { WorkerManager, WorkerPriority, AlertSeverity, WORKER_CONFIGS, DEFAULT_THRESHOLDS, createWorkerManager, workerManager, 
// Worker factories
createPerformanceWorker, createHealthWorker, createSwarmWorker, createGitWorker, createLearningWorker, createADRWorker, createDDDWorker, createSecurityWorker, createPatternsWorker, createCacheWorker, } from './workers/index.js';
// Workers - MCP Tools
export { workerMCPTools, createWorkerToolHandler, workerRunTool, workerStatusTool, workerAlertsTool, workerHistoryTool, workerStatuslineTool, workerRunAllTool, workerStartTool, workerStopTool, } from './workers/mcp-tools.js';
// Workers - Session Integration
export { onSessionStart, onSessionEnd, formatSessionStartOutput, generateShellHook, getGlobalManager, setGlobalManager, initializeGlobalManager, } from './workers/session-hook.js';
// Version
export const VERSION = '3.0.0-alpha.1';
/**
 * Initialize hooks system with default configuration
 */
export async function initializeHooks(options) {
    const { HookRegistry } = await import('./registry/index.js');
    const { HookExecutor } = await import('./executor/index.js');
    const { StatuslineGenerator } = await import('./statusline/index.js');
    const { DaemonManager, MetricsDaemon, SwarmMonitorDaemon, HooksLearningDaemon } = await import('./daemons/index.js');
    const registry = new HookRegistry();
    const executor = new HookExecutor(registry);
    const statusline = new StatuslineGenerator();
    // Start daemons if enabled
    if (options?.enableDaemons !== false) {
        const daemonManager = new DaemonManager();
        const metricsDaemon = new MetricsDaemon(daemonManager);
        const swarmDaemon = new SwarmMonitorDaemon(daemonManager);
        const learningDaemon = new HooksLearningDaemon(daemonManager);
        await Promise.all([
            metricsDaemon.start(),
            swarmDaemon.start(),
            learningDaemon.start(),
        ]);
    }
    return { registry, executor, statusline };
}
/**
 * Quick hooks execution helper
 */
export async function runHook(event, context) {
    const { executeHooks } = await import('./executor/index.js');
    return executeHooks(event, context);
}
/**
 * Register a new hook with simplified API
 */
export function addHook(event, handler, options) {
    const { registerHook: register } = require('./registry/index.js');
    const { HookPriority } = require('./types.js');
    return register(event, handler, options?.priority ?? HookPriority.Normal, { name: options?.name });
}
//# sourceMappingURL=index.js.map