/**
 * V3 Git Commit Hook
 *
 * TypeScript conversion of V2 git-commit-hook.sh.
 * Provides conventional commit formatting, JIRA ticket extraction,
 * co-author addition, and commit message validation.
 *
 * @module v3/shared/hooks/safety/git-commit
 */
import { HookContext, HookResult } from '../types.js';
import { HookRegistry } from '../registry.js';
/**
 * Git commit hook result
 */
export interface GitCommitResult extends HookResult {
    /** Original commit message */
    originalMessage: string;
    /** Modified commit message */
    modifiedMessage: string;
    /** Detected commit type */
    commitType?: CommitType;
    /** Extracted ticket reference */
    ticketReference?: string;
    /** Whether co-author was added */
    coAuthorAdded: boolean;
    /** Validation issues */
    validationIssues?: CommitValidationIssue[];
    /** Suggestions for improvement */
    suggestions?: string[];
}
/**
 * Commit type definition
 */
export type CommitType = 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'perf' | 'test' | 'build' | 'ci' | 'chore' | 'revert';
/**
 * Commit validation issue
 */
export interface CommitValidationIssue {
    /** Issue type */
    type: 'format' | 'length' | 'scope' | 'body' | 'breaking';
    /** Issue severity */
    severity: 'info' | 'warning' | 'error';
    /** Issue description */
    description: string;
    /** Suggested fix */
    suggestedFix?: string;
}
/**
 * Co-author configuration
 */
interface CoAuthor {
    name: string;
    email: string;
}
/**
 * Commit message configuration
 */
interface CommitConfig {
    /** Maximum subject line length */
    maxSubjectLength: number;
    /** Maximum body line length */
    maxBodyLength: number;
    /** Require conventional commit format */
    requireConventional: boolean;
    /** Add co-author by default */
    addCoAuthor: boolean;
    /** Co-author to add */
    coAuthor: CoAuthor;
    /** Add Claude Code reference */
    addClaudeReference: boolean;
    /** Allowed scopes */
    allowedScopes?: string[];
}
/**
 * Git Commit Hook Manager
 */
export declare class GitCommitHook {
    private registry;
    private config;
    constructor(registry: HookRegistry, config?: Partial<CommitConfig>);
    /**
     * Register git commit hooks
     */
    private registerHooks;
    /**
     * Handle pre-commit (when a git commit command is detected)
     */
    handlePreCommit(context: HookContext): Promise<HookResult>;
    /**
     * Process commit message
     */
    processCommitMessage(message: string, branchName?: string): Promise<GitCommitResult>;
    /**
     * Parse commit message into parts
     */
    private parseMessage;
    /**
     * Detect commit type from message
     */
    private detectCommitType;
    /**
     * Check if message has conventional commit prefix
     */
    private hasConventionalPrefix;
    /**
     * Lowercase first letter of a string
     */
    private lowercaseFirstLetter;
    /**
     * Extract ticket reference from branch name
     */
    private extractTicket;
    /**
     * Add ticket reference to message
     */
    private addTicketReference;
    /**
     * Validate conventional commit format
     */
    private validateConventional;
    /**
     * Process commit message manually
     */
    process(message: string, branchName?: string): Promise<GitCommitResult>;
    /**
     * Format a commit message with heredoc-style for git
     */
    formatForGit(message: string): string;
    /**
     * Generate a commit command with formatted message
     */
    generateCommitCommand(message: string): string;
    /**
     * Get commit type description
     */
    getCommitTypeDescription(type: CommitType): string;
    /**
     * Get all available commit types
     */
    getAllCommitTypes(): Array<{
        type: CommitType;
        description: string;
    }>;
    /**
     * Update configuration
     */
    setConfig(config: Partial<CommitConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): CommitConfig;
}
/**
 * Create git commit hook
 */
export declare function createGitCommitHook(registry: HookRegistry, config?: Partial<CommitConfig>): GitCommitHook;
export {};
//# sourceMappingURL=git-commit.d.ts.map