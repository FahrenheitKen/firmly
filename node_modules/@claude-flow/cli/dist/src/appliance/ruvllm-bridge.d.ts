/**
 * ruvLLM Bridge -- Local Language Model Inference from RuVector
 *
 * Extends @ruvector/core with on-device GGUF model inference.
 * Provides 3-tier routing:
 *   Tier 1: Agent Booster (WASM, <1ms) -- simple transforms
 *   Tier 2: Local model via ruvLLM (~200ms) -- routing, classification
 *   Tier 3: Cloud API (2-5s) -- complex reasoning
 *
 * All @ruvector/* packages are optional peer dependencies.
 * The bridge degrades gracefully when they are absent.
 *
 * @module @claude-flow/cli/appliance/ruvllm-bridge
 */
export interface RuvllmConfig {
    modelsDir: string;
    defaultModel?: string;
    maxTokens?: number;
    temperature?: number;
    contextSize?: number;
    kvCachePath?: string;
    verbose?: boolean;
}
export interface GenerateRequest {
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    stopSequences?: string[];
}
export interface GenerateResponse {
    text: string;
    model: string;
    tokensUsed: number;
    latencyMs: number;
    tier: 1 | 2 | 3;
    cached: boolean;
}
export interface ModelInfo {
    name: string;
    path: string;
    format: string;
    quantization: string;
    size: number;
    parameters: string;
    loaded: boolean;
}
export interface TierRouting {
    tier: 1 | 2 | 3;
    model: string;
    confidence: number;
}
export interface BridgeStatus {
    available: boolean;
    ruvectorCore: boolean;
    ruvectorRouter: boolean;
    ruvectorSona: boolean;
    modelsLoaded: string[];
    kvCacheSize: number;
}
export declare class RuvllmBridge {
    private config;
    private models;
    private activeModel;
    private kvCacheEntries;
    private ruvectorCore;
    private ruvectorRouter;
    private ruvectorSona;
    private ggufEngine;
    constructor(config: RuvllmConfig);
    /** Probe optional @ruvector packages, initialize GGUF engine, and scan modelsDir. */
    initialize(): Promise<void>;
    /** Return all discovered GGUF models. */
    listModels(): Promise<ModelInfo[]>;
    /** Load a model into memory (delegates to GGUF engine or @ruvector/core). */
    loadModel(name: string): Promise<void>;
    /**
     * Generate text from a prompt. Routes through tiers:
     * 1. Agent Booster (trivial transforms, no LLM).
     * 2. Local GGUF model via @ruvector/core.
     * 3. Cloud fallback (empty response -- caller handles upstream).
     */
    generate(request: GenerateRequest): Promise<GenerateResponse>;
    /** Route a task description to the optimal tier. Uses @ruvector/router when available. */
    routeTask(description: string): Promise<TierRouting>;
    /** Return current bridge status. */
    getStatus(): Promise<BridgeStatus>;
    /** Persist KV-cache, unload models, and clean up. */
    shutdown(): Promise<void>;
    private scanModelsDir;
    private tryImport;
    /** Tier-1 Agent Booster: handle trivial transforms without any LLM. */
    private tryAgentBooster;
}
/** Get or create the singleton RuvllmBridge. Config required on first call. */
export declare function getRuvllmBridge(config?: RuvllmConfig): RuvllmBridge;
/** Reset the singleton (useful for tests). */
export declare function resetRuvllmBridge(): void;
/** Check whether @ruvector/core is importable without loading the bridge. */
export declare function isRuvllmAvailable(): Promise<boolean>;
//# sourceMappingURL=ruvllm-bridge.d.ts.map