/**
 * Session Start Hook Integration
 *
 * Auto-starts workers when Claude Code session begins.
 */
import { WorkerManager } from './index.js';
export interface SessionHookConfig {
    projectRoot?: string;
    autoStart?: boolean;
    runInitialScan?: boolean;
    workers?: string[];
}
export interface SessionHookResult {
    success: boolean;
    manager: WorkerManager;
    initialResults?: Record<string, unknown>;
    error?: string;
}
/**
 * Initialize workers on session start
 *
 * Call this from your SessionStart hook to auto-start the worker system.
 */
export declare function onSessionStart(config?: SessionHookConfig): Promise<SessionHookResult>;
/**
 * Clean up workers on session end
 */
export declare function onSessionEnd(manager: WorkerManager): Promise<void>;
/**
 * Generate session start output for Claude Code hooks
 *
 * Returns formatted output suitable for Claude Code SessionStart hook.
 */
export declare function formatSessionStartOutput(result: SessionHookResult): string;
/**
 * Generate a shell hook script for integration with .claude/settings.json
 */
export declare function generateShellHook(projectRoot: string): string;
export declare function getGlobalManager(): WorkerManager | null;
export declare function setGlobalManager(manager: WorkerManager): void;
export declare function initializeGlobalManager(projectRoot?: string): Promise<WorkerManager>;
//# sourceMappingURL=session-hook.d.ts.map