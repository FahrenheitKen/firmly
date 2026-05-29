/**
 * V3 Hooks System - Type Definitions
 *
 * Provides extensible hook points for tool execution, file operations,
 * and session lifecycle events. Integrates with event bus for coordination.
 *
 * @module v3/shared/hooks/types
 */
/**
 * Hook event types
 */
export var HookEvent;
(function (HookEvent) {
    // Tool execution hooks
    HookEvent["PreToolUse"] = "hook:pre-tool-use";
    HookEvent["PostToolUse"] = "hook:post-tool-use";
    // File operation hooks
    HookEvent["PreEdit"] = "hook:pre-edit";
    HookEvent["PostEdit"] = "hook:post-edit";
    HookEvent["PreRead"] = "hook:pre-read";
    HookEvent["PostRead"] = "hook:post-read";
    HookEvent["PreWrite"] = "hook:pre-write";
    HookEvent["PostWrite"] = "hook:post-write";
    // Command execution hooks
    HookEvent["PreCommand"] = "hook:pre-command";
    HookEvent["PostCommand"] = "hook:post-command";
    // Session lifecycle hooks
    HookEvent["SessionStart"] = "hook:session-start";
    HookEvent["SessionEnd"] = "hook:session-end";
    HookEvent["SessionPause"] = "hook:session-pause";
    HookEvent["SessionResume"] = "hook:session-resume";
    // Agent lifecycle hooks
    HookEvent["PreAgentSpawn"] = "hook:pre-agent-spawn";
    HookEvent["PostAgentSpawn"] = "hook:post-agent-spawn";
    HookEvent["PreAgentTerminate"] = "hook:pre-agent-terminate";
    HookEvent["PostAgentTerminate"] = "hook:post-agent-terminate";
    // Task lifecycle hooks
    HookEvent["PreTaskExecute"] = "hook:pre-task-execute";
    HookEvent["PostTaskExecute"] = "hook:post-task-execute";
    HookEvent["PreTaskComplete"] = "hook:pre-task-complete";
    HookEvent["PostTaskComplete"] = "hook:post-task-complete";
    // Memory hooks
    HookEvent["PreMemoryStore"] = "hook:pre-memory-store";
    HookEvent["PostMemoryStore"] = "hook:post-memory-store";
    HookEvent["PreMemoryRetrieve"] = "hook:pre-memory-retrieve";
    HookEvent["PostMemoryRetrieve"] = "hook:post-memory-retrieve";
    // Error hooks
    HookEvent["OnError"] = "hook:on-error";
    HookEvent["OnWarning"] = "hook:on-warning";
})(HookEvent || (HookEvent = {}));
/**
 * Hook priority levels (higher = earlier execution)
 */
export var HookPriority;
(function (HookPriority) {
    HookPriority[HookPriority["Critical"] = 1000] = "Critical";
    HookPriority[HookPriority["High"] = 500] = "High";
    HookPriority[HookPriority["Normal"] = 0] = "Normal";
    HookPriority[HookPriority["Low"] = -500] = "Low";
    HookPriority[HookPriority["Lowest"] = -1000] = "Lowest";
})(HookPriority || (HookPriority = {}));
//# sourceMappingURL=types.js.map