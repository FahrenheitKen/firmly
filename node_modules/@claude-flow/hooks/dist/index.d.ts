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
export * from './types.js';
export { ReasoningBank, reasoningBank, type GuidancePattern, type GuidanceResult, type RoutingResult, type ReasoningBankConfig, type ReasoningBankMetrics, } from './reasoningbank/index.js';
export { GuidanceProvider, guidanceProvider, type ClaudeHookOutput, } from './reasoningbank/guidance-provider.js';
export { HookRegistry, defaultRegistry, registerHook, unregisterHook, } from './registry/index.js';
export { HookExecutor, defaultExecutor, executeHooks, } from './executor/index.js';
export { DaemonManager, MetricsDaemon, SwarmMonitorDaemon, HooksLearningDaemon, defaultDaemonManager, } from './daemons/index.js';
export { StatuslineGenerator, createShellStatusline, parseStatuslineData, defaultStatuslineGenerator, } from './statusline/index.js';
export { hooksMCPTools, getHooksTool, preEditTool, postEditTool, routeTaskTool, metricsTool, preCommandTool, postCommandTool, daemonStatusTool, statuslineTool, type MCPTool, } from './mcp/index.js';
export { OfficialHooksBridge, V3_TO_OFFICIAL_HOOK_MAP, V3_TOOL_MATCHERS, processOfficialHookInput, outputOfficialHookResult, executeWithBridge, type OfficialHookEvent, type OfficialHookInput, type OfficialHookOutput, } from './bridge/official-hooks-bridge.js';
export { SwarmCommunication, swarmComm, type SwarmMessage, type PatternBroadcast, type ConsensusRequest, type TaskHandoff, type SwarmAgentState, type SwarmConfig, } from './swarm/index.js';
export { WorkerManager, WorkerPriority, AlertSeverity, WORKER_CONFIGS, DEFAULT_THRESHOLDS, createWorkerManager, workerManager, createPerformanceWorker, createHealthWorker, createSwarmWorker, createGitWorker, createLearningWorker, createADRWorker, createDDDWorker, createSecurityWorker, createPatternsWorker, createCacheWorker, type WorkerConfig, type WorkerResult, type WorkerMetrics, type WorkerManagerStatus, type WorkerHandler, type WorkerAlert, type AlertThreshold, type PersistedWorkerState, type HistoricalMetric, type StatuslineData, } from './workers/index.js';
export { workerMCPTools, createWorkerToolHandler, workerRunTool, workerStatusTool, workerAlertsTool, workerHistoryTool, workerStatuslineTool, workerRunAllTool, workerStartTool, workerStopTool, type MCPToolDefinition, type MCPToolResult, } from './workers/mcp-tools.js';
export { onSessionStart, onSessionEnd, formatSessionStartOutput, generateShellHook, getGlobalManager, setGlobalManager, initializeGlobalManager, type SessionHookConfig, type SessionHookResult, } from './workers/session-hook.js';
export declare const VERSION = "3.0.0-alpha.1";
/**
 * Initialize hooks system with default configuration
 */
export declare function initializeHooks(options?: {
    enableDaemons?: boolean;
    enableStatusline?: boolean;
}): Promise<{
    registry: import('./registry/index.js').HookRegistry;
    executor: import('./executor/index.js').HookExecutor;
    statusline: import('./statusline/index.js').StatuslineGenerator;
}>;
/**
 * Quick hooks execution helper
 */
export declare function runHook(event: import('./types.js').HookEvent, context: Partial<import('./types.js').HookContext>): Promise<import('./types.js').HookExecutionResult>;
/**
 * Register a new hook with simplified API
 */
export declare function addHook(event: import('./types.js').HookEvent, handler: import('./types.js').HookHandler, options?: {
    priority?: import('./types.js').HookPriority;
    name?: string;
}): string;
//# sourceMappingURL=index.d.ts.map