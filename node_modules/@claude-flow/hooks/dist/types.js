/**
 * V3 Hooks System Types
 *
 * Core type definitions for the hooks system including:
 * - Hook events and priorities
 * - Hook handlers and context
 * - Execution results
 * - Daemon configuration
 * - Statusline data
 */
/**
 * Hook event types
 */
export var HookEvent;
(function (HookEvent) {
    // Tool lifecycle
    HookEvent["PreToolUse"] = "pre-tool-use";
    HookEvent["PostToolUse"] = "post-tool-use";
    // File operations
    HookEvent["PreEdit"] = "pre-edit";
    HookEvent["PostEdit"] = "post-edit";
    HookEvent["PreRead"] = "pre-read";
    HookEvent["PostRead"] = "post-read";
    // Command execution
    HookEvent["PreCommand"] = "pre-command";
    HookEvent["PostCommand"] = "post-command";
    // Task lifecycle
    HookEvent["PreTask"] = "pre-task";
    HookEvent["PostTask"] = "post-task";
    HookEvent["TaskProgress"] = "task-progress";
    // Session lifecycle
    HookEvent["SessionStart"] = "session-start";
    HookEvent["SessionEnd"] = "session-end";
    HookEvent["SessionRestore"] = "session-restore";
    // Agent lifecycle
    HookEvent["AgentSpawn"] = "agent-spawn";
    HookEvent["AgentTerminate"] = "agent-terminate";
    // Routing
    HookEvent["PreRoute"] = "pre-route";
    HookEvent["PostRoute"] = "post-route";
    // Learning
    HookEvent["PatternLearned"] = "pattern-learned";
    HookEvent["PatternConsolidated"] = "pattern-consolidated";
})(HookEvent || (HookEvent = {}));
/**
 * Hook priority levels
 */
export var HookPriority;
(function (HookPriority) {
    HookPriority[HookPriority["Critical"] = 1000] = "Critical";
    HookPriority[HookPriority["High"] = 100] = "High";
    HookPriority[HookPriority["Normal"] = 50] = "Normal";
    HookPriority[HookPriority["Low"] = 10] = "Low";
    HookPriority[HookPriority["Background"] = 1] = "Background";
})(HookPriority || (HookPriority = {}));
//# sourceMappingURL=types.js.map