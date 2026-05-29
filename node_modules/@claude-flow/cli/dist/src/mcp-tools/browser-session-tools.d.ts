/**
 * Browser Session Lifecycle MCP Tools (ADR-0001 ruflo-browser §7).
 *
 * Five lifecycle tools that wrap the 23 raw `browser_*` interaction tools
 * with RVF cognitive containers, ruvector trajectory recording, AgentDB
 * indexing, and AIDefence gates. Implements the contract from
 * `plugins/ruflo-browser/docs/adrs/0001-browser-skills-architecture.md`.
 *
 * Design notes:
 *   - These tools orchestrate at the *primitive* level — they shell out to
 *     the existing `agent-browser` CLI (for browser actions), `ruvector` CLI
 *     (for trajectory hooks + RVF), and the bridged `memory` namespace (for
 *     AgentDB index). They do not inline a replay engine; replay
 *     enumerates trajectory steps and returns them for the caller to dispatch.
 *   - Pinned to ruvector@0.2.25 to match `ruflo-ruvector` ADR-0001.
 *   - Best-effort: missing dependencies (no `ruvector`, no `agent-browser`,
 *     no AgentDB controller) degrade gracefully with a structured error
 *     rather than a process crash.
 */
import type { MCPTool } from './types.js';
export declare const browserSessionTools: MCPTool[];
export default browserSessionTools;
//# sourceMappingURL=browser-session-tools.d.ts.map