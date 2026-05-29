/**
 * Official Claude Code Hooks Bridge
 *
 * Maps V3 internal hook events to official Claude Code hook events.
 * This bridge enables seamless integration between claude-flow's
 * internal hook system and the official Claude Code plugin API.
 *
 * @module v3/hooks/bridge/official-hooks-bridge
 */
import { HookEvent, type HookHandler, type HookContext, type HookResult } from '../types.js';
/**
 * Official Claude Code hook event types
 * Based on https://code.claude.com/docs/en/hooks
 */
export type OfficialHookEvent = 'PreToolUse' | 'PostToolUse' | 'UserPromptSubmit' | 'PermissionRequest' | 'Notification' | 'Stop' | 'SubagentStop' | 'PreCompact' | 'SessionStart';
/**
 * Official hook input structure (received via stdin)
 */
export interface OfficialHookInput {
    session_id: string;
    transcript_path: string;
    cwd: string;
    permission_mode: string;
    hook_event_name: OfficialHookEvent;
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_output?: unknown;
    tool_success?: boolean;
    tool_exit_code?: number;
    prompt?: string;
    notification_message?: string;
    notification_level?: 'info' | 'warning' | 'error';
}
/**
 * Official hook output structure (returned via stdout)
 */
export interface OfficialHookOutput {
    /** Decision for permission/flow control */
    decision?: 'allow' | 'deny' | 'block' | 'ask' | 'approve' | 'stop' | 'continue';
    /** Reason for the decision */
    reason?: string;
    /** Whether to continue processing (false stops Claude) */
    continue?: boolean;
    /** Modified tool input (for PreToolUse) */
    updatedInput?: Record<string, unknown>;
    /** Suppress the tool call result display */
    suppressOutput?: boolean;
}
/**
 * Mapping from V3 HookEvent to Official hook events
 */
export declare const V3_TO_OFFICIAL_HOOK_MAP: Record<HookEvent, OfficialHookEvent | null>;
/**
 * Tool matchers for V3 events that map to PreToolUse/PostToolUse
 */
export declare const V3_TOOL_MATCHERS: Partial<Record<HookEvent, string>>;
/**
 * Bridge class for converting between V3 and official hooks
 */
export declare class OfficialHooksBridge {
    /**
     * Convert official hook input to V3 HookContext
     */
    static toV3Context(input: OfficialHookInput): HookContext;
    /**
     * Convert V3 HookResult to official hook output
     */
    static toOfficialOutput(result: HookResult, event: OfficialHookEvent): OfficialHookOutput;
    /**
     * Convert official hook event to V3 HookEvent
     */
    static officialToV3Event(officialEvent: OfficialHookEvent, toolName?: string): HookEvent;
    /**
     * Get tool matcher for a V3 event
     */
    static getToolMatcher(event: HookEvent): string | null;
    /**
     * Check if V3 event maps to an official hook
     */
    static hasOfficialMapping(event: HookEvent): boolean;
    /**
     * Create a CLI command for a V3 hook handler
     */
    static createCLICommand(event: HookEvent, handler: string): string;
}
/**
 * Process stdin from official Claude Code hook system
 */
export declare function processOfficialHookInput(): Promise<OfficialHookInput | null>;
/**
 * Output result to official Claude Code hook system
 */
export declare function outputOfficialHookResult(output: OfficialHookOutput): void;
/**
 * Execute a V3 handler and bridge to official output
 */
export declare function executeWithBridge(input: OfficialHookInput, handler: HookHandler): Promise<OfficialHookOutput>;
export default OfficialHooksBridge;
//# sourceMappingURL=official-hooks-bridge.d.ts.map