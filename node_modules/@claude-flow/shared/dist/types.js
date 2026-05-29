/**
 * V3 Claude-Flow Shared Types
 * Core type definitions for the 15-agent swarm coordination system
 *
 * Based on ADR-002 (DDD) and ADR-003 (Single Coordination Engine)
 */
export const V3_PERFORMANCE_TARGETS = {
    flashAttention: { minSpeedup: 2.49, maxSpeedup: 7.47 },
    agentDbSearch: { minSpeedup: 150, maxSpeedup: 12500 },
    memoryReduction: { minPercent: 50, maxPercent: 75 },
    codeReduction: { targetLines: 5000, currentLines: 15000 },
    startupTime: { targetMs: 500 },
    sonaLearning: { targetMs: 0.05 }
};
export function success(value) {
    return { success: true, value };
}
export function failure(error) {
    return { success: false, error };
}
//# sourceMappingURL=types.js.map