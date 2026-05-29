/**
 * RuVector Integration Module for Claude Flow CLI
 *
 * Provides integration with @ruvector packages for:
 * - Q-Learning based task routing
 * - Mixture of Experts (MoE) routing
 * - AST code analysis
 * - Diff classification
 * - Coverage-based routing
 * - Graph boundary analysis
 * - Flash Attention for faster similarity computations
 *
 * @module @claude-flow/cli/ruvector
 */
export { QLearningRouter, createQLearningRouter } from './q-learning-router.js';
// #1773 item 4 — moe-router migrated to @claude-flow/neural. Direct
// consumers (hooks-tools.ts) import from '@claude-flow/neural' explicitly;
// re-exporting through this barrel would force vitest to resolve the
// neural pkg's transitive @ruvector/sona dep eagerly. Keep imports direct.
export { ASTAnalyzer, createASTAnalyzer } from './ast-analyzer.js';
export { DiffClassifier, createDiffClassifier, 
// MCP tool exports
analyzeDiff, analyzeDiffSync, assessFileRisk, assessOverallRisk, classifyDiff, suggestReviewers, getGitDiffNumstat, getGitDiffNumstatAsync, 
// Cache control
clearDiffCache, clearAllDiffCaches, } from './diff-classifier.js';
export { CoverageRouter, createCoverageRouter, 
// MCP tool exports
coverageRoute, coverageSuggest, coverageGaps, 
// Cache utilities (NEW)
clearCoverageCache, getCoverageCacheStats, } from './coverage-router.js';
export { coverageRouterTools, hooksCoverageRoute, hooksCoverageSuggest, hooksCoverageGaps } from './coverage-tools.js';
export { buildDependencyGraph, analyzeGraph, analyzeMinCutBoundaries, analyzeModuleCommunities, detectCircularDependencies, exportToDot, loadRuVector, fallbackMinCut, fallbackLouvain, 
// Cache utilities (NEW)
clearGraphCaches, getGraphCacheStats, } from './graph-analyzer.js';
// #1773 item 4 — flash-attention migrated to @claude-flow/neural. Direct
// consumers (hooks-tools.ts, neural-tools.ts) import from '@claude-flow/neural'
// explicitly; re-exporting through this barrel pulls the package's
// transitive @ruvector/sona dep into vitest's eager resolution.
export { LoRAAdapter, getLoRAAdapter, resetLoRAAdapter, createLoRAAdapter, adaptEmbedding, trainLoRA, getLoRAStats, DEFAULT_RANK, DEFAULT_ALPHA, INPUT_DIM as LORA_INPUT_DIM, OUTPUT_DIM as LORA_OUTPUT_DIM, } from './lora-adapter.js';
export { ModelRouter, getModelRouter, resetModelRouter, createModelRouter, routeToModel, routeToModelFull, analyzeTaskComplexity, getModelRouterStats, recordModelOutcome, MODEL_CAPABILITIES, COMPLEXITY_INDICATORS, } from './model-router.js';
export { SemanticRouter, createSemanticRouter, } from './semantic-router.js';
// ── RuVector LLM WASM (inference utilities) ─────────────────
export { isRuvllmWasmAvailable, initRuvllmWasm, getRuvllmStatus, createHnswRouter, createSonaInstant, createMicroLora, formatChat, createKvCache, createGenerateConfig, createBufferPool, createInferenceArena, HNSW_MAX_SAFE_PATTERNS, } from './ruvllm-wasm.js';
// ── Agent WASM (sandboxed agent runtime) ────────────────────
export { isAgentWasmAvailable, initAgentWasm, createWasmAgent, promptWasmAgent, executeWasmTool, getWasmAgent, listWasmAgents, terminateWasmAgent, getWasmAgentState, getWasmAgentTools, getWasmAgentTodos, exportWasmState, createWasmMcpServer, listGalleryTemplates, getGalleryCount, getGalleryCategories, searchGalleryTemplates, getGalleryTemplate, createAgentFromTemplate, buildRvfContainer, buildRvfFromTemplate, } from './agent-wasm.js';
/**
 * Check if ruvector packages are available
 */
export async function isRuvectorAvailable() {
    try {
        await import('@ruvector/core');
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if @ruvector/learning-wasm is available and loadable
 */
export async function isWasmBackendAvailable() {
    try {
        const wasm = await import('@ruvector/learning-wasm');
        return typeof wasm.WasmMicroLoRA === 'function' && typeof wasm.initSync === 'function';
    }
    catch {
        return false;
    }
}
/**
 * Get ruvector version if available
 */
export async function getRuvectorVersion() {
    try {
        const ruvector = await import('@ruvector/core');
        return ruvector.version || '1.0.0';
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=index.js.map