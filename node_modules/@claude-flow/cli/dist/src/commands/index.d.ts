/**
 * V3 CLI Commands Index
 * Central registry for all CLI commands
 *
 * NOTE: All commands are synchronously imported at module load time (lines below).
 * The commandLoaders/loadCommand infrastructure provides an async fallback for
 * commands looked up via getCommandAsync() but does NOT reduce startup time since
 * all modules are already imported synchronously for the commands array and
 * commandsByCategory exports.
 */
import type { Command } from '../types.js';
export { initCommand } from './init.js';
export { startCommand } from './start.js';
export { statusCommand } from './status.js';
export { taskCommand } from './task.js';
export { sessionCommand } from './session.js';
export { agentCommand } from './agent.js';
export { swarmCommand } from './swarm.js';
export { memoryCommand } from './memory.js';
export { mcpCommand } from './mcp.js';
export { hooksCommand } from './hooks.js';
export declare function getConfigCommand(): Promise<Command | undefined>;
export declare function getMigrateCommand(): Promise<Command | undefined>;
export declare function getWorkflowCommand(): Promise<Command | undefined>;
export declare function getHiveMindCommand(): Promise<Command | undefined>;
export declare function getProcessCommand(): Promise<Command | undefined>;
export declare function getTaskCommand(): Promise<Command | undefined>;
export declare function getSessionCommand(): Promise<Command | undefined>;
export declare function getNeuralCommand(): Promise<Command | undefined>;
export declare function getSecurityCommand(): Promise<Command | undefined>;
export declare function getPerformanceCommand(): Promise<Command | undefined>;
export declare function getProvidersCommand(): Promise<Command | undefined>;
export declare function getPluginsCommand(): Promise<Command | undefined>;
export declare function getDeploymentCommand(): Promise<Command | undefined>;
export declare function getClaimsCommand(): Promise<Command | undefined>;
export declare function getEmbeddingsCommand(): Promise<Command | undefined>;
export declare function getCompletionsCommand(): Promise<Command | undefined>;
export declare function getAnalyzeCommand(): Promise<Command | undefined>;
export declare function getRouteCommand(): Promise<Command | undefined>;
export declare function getProgressCommand(): Promise<Command | undefined>;
export declare function getIssuesCommand(): Promise<Command | undefined>;
export declare function getRuvectorCommand(): Promise<Command | undefined>;
export declare function getGuidanceCommand(): Promise<Command | undefined>;
export declare function getApplianceCommand(): Promise<Command | undefined>;
export declare function getCleanupCommand(): Promise<Command | undefined>;
export declare function getAutopilotCommand(): Promise<Command | undefined>;
/**
 * Core commands loaded synchronously (available immediately)
 * Advanced commands loaded on-demand for faster startup
 */
export declare const commands: Command[];
/**
 * Commands organized by category for help display (synchronous core only).
 * @deprecated Use getCommandsByCategory() for full categorized listing.
 */
export declare const commandsByCategory: {
    primary: Command[];
    advanced: Command[];
    utility: Command[];
    analysis: Command[];
    management: Command[];
};
/**
 * Async version that loads all commands by category (PERF-03).
 * Use this for help display and full command listings.
 */
export declare function getCommandsByCategory(): Promise<Record<string, Command[]>>;
/**
 * Command registry map for quick lookup
 * Supports both sync (core commands) and async (lazy-loaded) commands
 */
export declare const commandRegistry: Map<string, Command>;
/**
 * Get command by name (sync for core commands, returns undefined for lazy commands)
 * Use getCommandAsync for lazy-loaded commands
 */
export declare function getCommand(name: string): Command | undefined;
/**
 * Get command by name (async - supports lazy loading)
 */
export declare function getCommandAsync(name: string): Promise<Command | undefined>;
/**
 * Check if command exists (sync check for core commands)
 */
export declare function hasCommand(name: string): boolean;
/**
 * Get the names of all lazy-loadable commands (the commandLoaders keys).
 * Used by the CLI constructor to register these names with the parser so
 * the two-pass argument walker can recognize them as commands before their
 * modules have been imported. Fix for #1596.
 */
export declare function getLazyCommandNames(): string[];
/**
 * Get all command names (including aliases and lazy-loadable)
 */
export declare function getCommandNames(): string[];
/**
 * Get all unique commands (excluding aliases)
 */
export declare function getUniqueCommands(): Command[];
/**
 * Load all commands (populates lazy-loaded commands)
 * Use this when you need all commands available synchronously
 */
export declare function loadAllCommands(): Promise<Command[]>;
/**
 * Setup commands in a CLI instance
 */
export declare function setupCommands(cli: {
    command: (cmd: Command) => void;
}): void;
/**
 * Setup all commands including lazy-loaded (async)
 */
export declare function setupAllCommands(cli: {
    command: (cmd: Command) => void;
}): Promise<void>;
//# sourceMappingURL=index.d.ts.map