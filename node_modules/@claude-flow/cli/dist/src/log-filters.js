"use strict";
/**
 * Console filter for the cosmetic "[AgentDB Patch] Controller index not found"
 * warning emitted by agentic-flow's runtime patch (it expects agentdb v1.x
 * layout but we use v3). This file MUST be imported as the first side-effect
 * import in any entry point so the patch is in place before agentic-flow
 * (and anything that transitively imports it) loads.
 *
 * The previous attempt put the suppression as a top-level code block inside
 * src/index.ts, but ES module imports are evaluated before the file's own
 * top-level code, so transitive imports of agentic-flow were still
 * triggering the warning before the suppression took effect. A dedicated
 * side-effect module imported FIRST avoids that.
 *
 * Tight match: requires BOTH "[AgentDB Patch]" AND "Controller index not
 * found". Other [AgentDB Patch] messages (real issues) flow through.
 * Audit log audit_1776483149979 flagged the previous broad filter as too
 * aggressive — this one is tight enough to be safe.
 */
const isCosmeticAgentdbPatchNoise = (msg) => {
    const s = String(msg ?? '');
    return s.includes('[AgentDB Patch]') && s.includes('Controller index not found');
};
const origWarn = console.warn.bind(console);
const origLog = console.log.bind(console);
console.warn = (...args) => {
    if (isCosmeticAgentdbPatchNoise(args[0]))
        return;
    origWarn(...args);
};
console.log = (...args) => {
    if (isCosmeticAgentdbPatchNoise(args[0]))
        return;
    origLog(...args);
};
//# sourceMappingURL=log-filters.js.map