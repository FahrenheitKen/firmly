/**
 * ruvLLM GGUF Inference Engine -- Pure Node.js GGUF Model Interface
 *
 * Provides:
 *   1. GGUF binary header parsing (metadata without loading weights)
 *   2. Model loading abstraction (node-llama-cpp when available, metadata-only fallback)
 *   3. Token generation interface with async iterator streaming
 *   4. KV-cache persistence to RVF-compatible binary format
 *
 * Zero external dependencies. node-llama-cpp is an optional peer.
 *
 * @module @claude-flow/cli/appliance/gguf-engine
 */
export interface GgufMetadata {
    magic: string;
    version: number;
    tensorCount: number;
    kvCount: number;
    architecture?: string;
    name?: string;
    contextLength?: number;
    embeddingLength?: number;
    blockCount?: number;
    vocabSize?: number;
    quantization?: string;
    fileSize: number;
    metadata: Record<string, unknown>;
}
export interface GgufEngineConfig {
    contextSize?: number;
    maxTokens?: number;
    temperature?: number;
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
    metadataOnly: boolean;
}
/**
 * Parse the header and metadata from a GGUF file without loading tensors.
 * Reads only the first 256 KB of the file.
 */
export declare function parseGgufHeader(path: string): Promise<GgufMetadata>;
export declare class GgufEngine {
    private config;
    private llamaCpp;
    private llamaModel;
    private llamaContext;
    private loadedModels;
    private activeModelPath;
    private kvCache;
    constructor(config: GgufEngineConfig);
    /** Probe for node-llama-cpp availability. */
    initialize(): Promise<void>;
    /** Parse GGUF header and optionally load the model for inference. */
    loadModel(path: string): Promise<GgufMetadata>;
    /** Generate text. Delegates to node-llama-cpp or returns a metadata-only stub. */
    generate(request: GenerateRequest): Promise<GenerateResponse>;
    /** Stream tokens via async iterator. Falls back to yielding full response. */
    stream(request: GenerateRequest): AsyncGenerator<string>;
    /**
     * Persist the KV cache to an RVF-compatible binary file.
     * Format: RVKV magic | version u32 | model SHA-256 (32B) | entry count u32
     *         entries: [key_len u32, key, val_len u32, val] | footer SHA-256 (32B)
     */
    persistKvCache(outputPath: string): Promise<void>;
    /** Restore KV cache from an RVF-compatible binary file. */
    loadKvCache(inputPath: string): Promise<void>;
    /** Return metadata for all loaded models. */
    getLoadedModels(): GgufMetadata[];
    /** Store a key-value pair in the in-memory KV cache. */
    setKvEntry(key: string, value: Buffer): void;
    /** Retrieve a key-value pair from the in-memory KV cache. */
    getKvEntry(key: string): Buffer | undefined;
    /** Release resources, unload models, and optionally persist the KV cache. */
    shutdown(): Promise<void>;
    private tryLoadLlamaCpp;
}
//# sourceMappingURL=gguf-engine.d.ts.map