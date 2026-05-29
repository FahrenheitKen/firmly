/**
 * V3 Bash Safety Hook
 *
 * TypeScript conversion of V2 bash-hook.sh.
 * Provides command safety analysis, dangerous command detection,
 * secret detection, and safe alternatives.
 *
 * @module v3/shared/hooks/safety/bash-safety
 */
import { HookContext, HookResult } from '../types.js';
import { HookRegistry } from '../registry.js';
/**
 * Bash safety hook result
 */
export interface BashSafetyResult extends HookResult {
    /** Risk level assessment */
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    /** Whether the command should be blocked */
    blocked: boolean;
    /** Reason for blocking (if blocked) */
    blockReason?: string;
    /** Modified command (if applicable) */
    modifiedCommand?: string;
    /** Detected risks */
    risks: CommandRisk[];
    /** Safe alternatives */
    safeAlternatives?: string[];
    /** Warnings (non-blocking) */
    warnings?: string[];
    /** Missing dependencies detected */
    missingDependencies?: string[];
    /** Redacted command (secrets removed) */
    redactedCommand?: string;
}
/**
 * Command risk definition
 */
export interface CommandRisk {
    /** Risk type */
    type: 'dangerous' | 'destructive' | 'secret' | 'privilege' | 'network' | 'resource';
    /** Risk severity */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** Risk description */
    description: string;
    /** Pattern that matched */
    pattern?: string;
}
/**
 * Bash Safety Hook Manager
 */
export declare class BashSafetyHook {
    private registry;
    private blockedCommands;
    private availableDependencies;
    constructor(registry: HookRegistry);
    /**
     * Register bash safety hooks
     */
    private registerHooks;
    /**
     * Detect available dependencies
     */
    private detectAvailableDependencies;
    /**
     * Analyze a command for safety
     */
    analyzeCommand(context: HookContext): Promise<BashSafetyResult>;
    /**
     * Detect secrets in command
     */
    private detectSecrets;
    /**
     * Check for missing dependencies
     */
    private checkDependencies;
    /**
     * Calculate overall risk level
     */
    private calculateRiskLevel;
    /**
     * Create a result object
     */
    private createResult;
    /**
     * Manually analyze a command
     */
    analyze(command: string): Promise<BashSafetyResult>;
    /**
     * Add a custom dangerous pattern
     */
    addDangerousPattern(pattern: RegExp, type: CommandRisk['type'], severity: CommandRisk['severity'], description: string, block?: boolean): void;
    /**
     * Mark a dependency as available
     */
    markDependencyAvailable(dependency: string): void;
    /**
     * Check if a command would be blocked
     */
    wouldBlock(command: string): boolean;
}
/**
 * Create bash safety hook
 */
export declare function createBashSafetyHook(registry: HookRegistry): BashSafetyHook;
//# sourceMappingURL=bash-safety.d.ts.map