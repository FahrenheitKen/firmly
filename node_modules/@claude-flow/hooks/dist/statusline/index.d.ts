/**
 * V3 Statusline Generator
 *
 * Generates statusline data for Claude Code integration.
 * Provides real-time progress, metrics, and status information.
 *
 * Format matches the working .claude/statusline.sh output:
 * ▊ Claude Flow V3 ● ruvnet  │  ⎇ v3  │  Opus 4.5
 * ─────────────────────────────────────────────────────
 * 🏗️  DDD Domains    [●●●●●]  5/5    ⚡ 1.0x → 2.49x-7.47x
 * 🤖 Swarm  ◉ [58/15]  👥 0    🟢 CVE 3/3    💾 22282MB    📂  47%    🧠  10%
 * 🔧 Architecture    DDD ● 98%  │  Security ●CLEAN  │  Memory ●AgentDB  │  Integration ●
 */
import type { StatuslineData, StatuslineConfig } from '../types.js';
/**
 * Extended statusline data with system metrics
 */
interface ExtendedStatuslineData extends StatuslineData {
    system: {
        memoryMB: number;
        contextPct: number;
        intelligencePct: number;
        subAgents: number;
    };
    user: {
        name: string;
        gitBranch: string;
        modelName: string;
    };
}
/**
 * Statusline data sources interface
 */
interface StatuslineDataSources {
    getV3Progress?: () => StatuslineData['v3Progress'];
    getSecurityStatus?: () => StatuslineData['security'];
    getSwarmActivity?: () => StatuslineData['swarm'];
    getHooksMetrics?: () => StatuslineData['hooks'];
    getPerformanceTargets?: () => StatuslineData['performance'];
    getSystemMetrics?: () => ExtendedStatuslineData['system'];
    getUserInfo?: () => ExtendedStatuslineData['user'];
}
/**
 * Statusline Generator
 */
export declare class StatuslineGenerator {
    private config;
    private dataSources;
    private cachedData;
    private cacheTime;
    private cacheTTL;
    private projectRoot;
    constructor(config?: Partial<StatuslineConfig>, projectRoot?: string);
    /**
     * Register data sources
     */
    registerDataSources(sources: StatuslineDataSources): void;
    /**
     * Generate extended statusline data
     */
    generateData(): ExtendedStatuslineData;
    /**
     * Generate formatted statusline string matching .claude/statusline.sh format
     */
    generateStatusline(): string;
    /**
     * Generate JSON output for CLI consumption
     */
    generateJSON(): string;
    /**
     * Generate compact JSON for shell integration
     */
    generateCompactJSON(): string;
    /**
     * Invalidate cache
     */
    invalidateCache(): void;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<StatuslineConfig>): void;
    /**
     * Get V3 progress data
     */
    private getV3Progress;
    /**
     * Get security status
     */
    private getSecurityStatus;
    /**
     * Get swarm activity
     */
    private getSwarmActivity;
    /**
     * Get hooks metrics
     */
    private getHooksMetrics;
    /**
     * Get performance targets
     */
    private getPerformanceTargets;
    /**
     * Get system metrics (memory, context, intelligence)
     */
    private getSystemMetrics;
    /**
     * Get user info (name, branch, model)
     */
    private getUserInfo;
    /**
     * Generate ASCII progress bar with colored dots
     */
    private generateProgressBar;
}
/**
 * Create statusline for shell script integration
 */
export declare function createShellStatusline(data: ExtendedStatuslineData): string;
/**
 * Parse statusline data from JSON
 */
export declare function parseStatuslineData(json: string): StatuslineData | null;
/**
 * Default statusline generator instance
 */
export declare const defaultStatuslineGenerator: StatuslineGenerator;
export { StatuslineGenerator as default };
//# sourceMappingURL=index.d.ts.map