/**
 * V3 File Organization Hook
 *
 * TypeScript conversion of V2 file-hook.sh.
 * Enforces file organization, blocks writes to root folder,
 * suggests proper directories, and recommends formatters.
 *
 * @module v3/shared/hooks/safety/file-organization
 */
import { HookContext, HookResult } from '../types.js';
import { HookRegistry } from '../registry.js';
/**
 * File organization hook result
 */
export interface FileOrganizationResult extends HookResult {
    /** Whether the file operation should be blocked */
    blocked: boolean;
    /** Reason for blocking */
    blockReason?: string;
    /** Suggested new path */
    suggestedPath?: string;
    /** Suggested directory */
    suggestedDirectory?: string;
    /** Formatter recommendation */
    formatter?: FormatterRecommendation;
    /** Linter recommendation */
    linter?: LinterRecommendation;
    /** File type detected */
    fileType?: string;
    /** Warnings */
    warnings?: string[];
    /** Organization issues detected */
    issues?: OrganizationIssue[];
}
/**
 * Formatter recommendation
 */
export interface FormatterRecommendation {
    /** Formatter name */
    name: string;
    /** Command to run */
    command: string;
    /** Config file to check for */
    configFile?: string;
    /** Whether config exists */
    configExists?: boolean;
}
/**
 * Linter recommendation
 */
export interface LinterRecommendation {
    /** Linter name */
    name: string;
    /** Command to run */
    command: string;
    /** Config file to check for */
    configFile?: string;
}
/**
 * Organization issue
 */
export interface OrganizationIssue {
    /** Issue type */
    type: 'wrong-directory' | 'naming-convention' | 'missing-config' | 'root-write';
    /** Issue severity */
    severity: 'info' | 'warning' | 'error';
    /** Issue description */
    description: string;
    /** Suggested fix */
    suggestedFix?: string;
}
/**
 * File Organization Hook Manager
 */
export declare class FileOrganizationHook {
    private registry;
    private projectRoot;
    constructor(registry: HookRegistry);
    /**
     * Register file organization hooks
     */
    private registerHooks;
    /**
     * Analyze file operation for organization issues
     */
    analyzeFileOperation(context: HookContext): Promise<FileOrganizationResult>;
    /**
     * Check if directory is root
     */
    private isRootDirectory;
    /**
     * Normalize path for comparison
     */
    private normalizePath;
    /**
     * Get file type information
     */
    private getFileTypeInfo;
    /**
     * Check naming convention
     */
    private checkNamingConvention;
    /**
     * Get formatter recommendation
     */
    private getFormatterRecommendation;
    /**
     * Get linter recommendation
     */
    private getLinterRecommendation;
    /**
     * Create result object
     */
    private createResult;
    /**
     * Manually analyze a file path
     */
    analyze(filePath: string): Promise<FileOrganizationResult>;
    /**
     * Get suggested directory for a file
     */
    getSuggestedDirectory(fileName: string): string | null;
    /**
     * Check if a file path would be blocked
     */
    wouldBlock(filePath: string): boolean;
    /**
     * Set project root directory
     */
    setProjectRoot(root: string): void;
    /**
     * Get all formatter recommendations
     */
    getAllFormatters(): Record<string, FormatterRecommendation>;
    /**
     * Get all linter recommendations
     */
    getAllLinters(): Record<string, LinterRecommendation>;
}
/**
 * Create file organization hook
 */
export declare function createFileOrganizationHook(registry: HookRegistry): FileOrganizationHook;
//# sourceMappingURL=file-organization.d.ts.map