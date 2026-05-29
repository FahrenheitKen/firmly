/**
 * V3 LLM Hooks System
 *
 * Provides pre/post operation hooks for all LLM calls with:
 * - Request caching with memory persistence
 * - Provider-specific optimizations
 * - Cost tracking and optimization
 * - Performance metrics
 * - Pattern learning
 *
 * @module @claude-flow/hooks/llm/llm-hooks
 */
export interface LLMHookContext {
    correlationId: string;
    sessionId?: string;
    agentId?: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
export interface LLMHookPayload {
    provider: string;
    model: string;
    operation: 'complete' | 'stream' | 'embed';
    request: LLMRequestPayload;
    response?: LLMResponsePayload;
    metrics?: LLMMetrics;
}
export interface LLMRequestPayload {
    messages: Array<{
        role: string;
        content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
    [key: string]: unknown;
}
export interface LLMResponsePayload {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    cost?: {
        promptCost: number;
        completionCost: number;
        totalCost: number;
    };
    latency?: number;
    [key: string]: unknown;
}
export interface LLMMetrics {
    requestStart: number;
    responseEnd?: number;
    latency?: number;
    cacheHit?: boolean;
    tokenEstimate?: number;
    costEstimate?: number;
}
export interface LLMHookResult {
    continue: boolean;
    modified: boolean;
    payload?: LLMHookPayload;
    sideEffects?: LLMSideEffect[];
    cachedResponse?: LLMResponsePayload;
}
export interface LLMSideEffect {
    type: 'memory' | 'metric' | 'log' | 'pattern';
    action: string;
    data: Record<string, unknown>;
}
export declare function preLLMCallHook(payload: LLMHookPayload, context: LLMHookContext): Promise<LLMHookResult>;
export declare function postLLMCallHook(payload: LLMHookPayload, context: LLMHookContext): Promise<LLMHookResult>;
export declare function errorLLMCallHook(payload: LLMHookPayload, error: Error, context: LLMHookContext): Promise<LLMHookResult>;
export declare function clearLLMCache(): void;
export declare function getLLMCacheStats(): {
    size: number;
    totalHits: number;
    entries: Array<{
        key: string;
        hits: number;
        age: number;
    }>;
};
export declare const llmHooks: {
    preLLMCall: typeof preLLMCallHook;
    postLLMCall: typeof postLLMCallHook;
    errorLLMCall: typeof errorLLMCallHook;
    clearCache: typeof clearLLMCache;
    getCacheStats: typeof getLLMCacheStats;
};
export default llmHooks;
//# sourceMappingURL=llm-hooks.d.ts.map