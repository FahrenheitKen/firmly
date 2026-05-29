/**
 * V3 ReasoningBank - Pattern Learning with AgentDB
 *
 * Connects hooks to persistent vector storage using AgentDB adapter.
 * No JSON - all patterns stored as vectors in memory.db
 *
 * Features:
 * - Real HNSW indexing (M=16, efConstruction=200) for 150x+ faster search
 * - ONNX embeddings via @claude-flow/embeddings (MiniLM-L6 384-dim)
 * - AgentDB backend for persistence
 * - Pattern promotion from short-term to long-term memory
 *
 * @module @claude-flow/hooks/reasoningbank
 */
import { EventEmitter } from 'node:events';
import type { HookContext } from '../types.js';
/**
 * Pattern stored in AgentDB
 */
export interface GuidancePattern {
    id: string;
    strategy: string;
    domain: string;
    embedding: Float32Array;
    quality: number;
    usageCount: number;
    successCount: number;
    createdAt: number;
    updatedAt: number;
    metadata: Record<string, unknown>;
}
/**
 * Guidance result from pattern search
 */
export interface GuidanceResult {
    patterns: Array<{
        pattern: GuidancePattern;
        similarity: number;
    }>;
    context: string;
    recommendations: string[];
    agentSuggestion?: {
        agent: string;
        confidence: number;
        reasoning: string;
    };
    searchTimeMs: number;
}
/**
 * Agent routing result
 */
export interface RoutingResult {
    agent: string;
    confidence: number;
    alternatives: Array<{
        agent: string;
        confidence: number;
    }>;
    reasoning: string;
    historicalPerformance?: {
        successRate: number;
        avgQuality: number;
        taskCount: number;
    };
}
/**
 * ReasoningBank configuration
 */
export interface ReasoningBankConfig {
    /** Vector dimensions (384 for MiniLM, 1536 for OpenAI) */
    dimensions: number;
    /** HNSW M parameter */
    hnswM: number;
    /** HNSW ef construction */
    hnswEfConstruction: number;
    /** HNSW ef search */
    hnswEfSearch: number;
    /** Maximum patterns in short-term memory */
    maxShortTerm: number;
    /** Maximum patterns in long-term memory */
    maxLongTerm: number;
    /** Promotion threshold (usage count) */
    promotionThreshold: number;
    /** Quality threshold for promotion */
    qualityThreshold: number;
    /** Deduplication similarity threshold */
    dedupThreshold: number;
    /** Database path */
    dbPath: string;
    /** Use mock embeddings (for testing) */
    useMockEmbeddings?: boolean;
}
/**
 * ReasoningBank metrics
 */
export interface ReasoningBankMetrics {
    patternsStored: number;
    patternsRetrieved: number;
    searchCount: number;
    totalSearchTime: number;
    promotions: number;
    hnswSearchTime: number;
    bruteForceSearchTime: number;
}
/**
 * ReasoningBank - Vector-based pattern storage and retrieval
 *
 * Uses AgentDB adapter for HNSW-indexed pattern storage.
 * Provides guidance generation from learned patterns.
 */
export declare class ReasoningBank extends EventEmitter {
    private config;
    private agentDB;
    private hnswIndex;
    private embeddingService;
    private initialized;
    private useRealBackend;
    private shortTermPatterns;
    private longTermPatterns;
    private metrics;
    constructor(config?: Partial<ReasoningBankConfig>);
    /**
     * Initialize ReasoningBank with AgentDB backend and real HNSW
     */
    initialize(): Promise<void>;
    /**
     * Load optional dependencies
     */
    private loadDependencies;
    /**
     * Store a new pattern from hook execution
     */
    storePattern(strategy: string, domain: string, metadata?: Record<string, unknown>): Promise<{
        id: string;
        action: 'created' | 'updated';
    }>;
    /**
     * Search for similar patterns using HNSW (if available) or brute-force
     */
    searchPatterns(query: string | Float32Array, k?: number): Promise<Array<{
        pattern: GuidancePattern;
        similarity: number;
    }>>;
    /**
     * Brute-force search (fallback)
     */
    private bruteForceSearch;
    /**
     * Generate guidance for a given context
     */
    generateGuidance(context: HookContext): Promise<GuidanceResult>;
    /**
     * Route task to optimal agent based on learned patterns
     */
    routeTask(task: string): Promise<RoutingResult>;
    /**
     * Record pattern usage outcome
     */
    recordOutcome(patternId: string, success: boolean): Promise<void>;
    /**
     * Consolidate patterns (dedup, prune, promote)
     * Called by HooksLearningDaemon
     */
    consolidate(): Promise<{
        duplicatesRemoved: number;
        patternsPruned: number;
        patternsPromoted: number;
    }>;
    /**
     * Get statistics
     */
    getStats(): {
        shortTermCount: number;
        longTermCount: number;
        metrics: ReasoningBankMetrics;
        avgSearchTime: number;
        useRealBackend: boolean;
        hnswSpeedup: number;
    };
    /**
     * Export patterns for backup/transfer
     */
    exportPatterns(): Promise<{
        shortTerm: GuidancePattern[];
        longTerm: GuidancePattern[];
    }>;
    /**
     * Import patterns from backup
     */
    importPatterns(data: {
        shortTerm: GuidancePattern[];
        longTerm: GuidancePattern[];
    }): Promise<{
        imported: number;
    }>;
    private ensureInitialized;
    private loadPatterns;
    private storeInAgentDB;
    private updateInStorage;
    private deleteFromStorage;
    private entryToPattern;
    private buildQueryFromContext;
    private detectDomains;
    private suggestAgent;
    private calculateQuality;
    private shouldPromote;
    private checkPromotion;
    private promotePattern;
    private cosineSimilarity;
}
export declare const reasoningBank: ReasoningBank;
//# sourceMappingURL=index.d.ts.map