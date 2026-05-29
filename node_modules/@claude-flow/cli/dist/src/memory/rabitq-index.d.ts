/**
 * RaBitQ Index — 1-bit quantized vector pre-filter (32× compression)
 *
 * Wraps @ruvector/rabitq-wasm to provide Hamming-scan pre-filtering
 * over quantized embeddings. Candidates are reranked with exact cosine
 * similarity from the full-precision source (HNSW or SQLite).
 *
 * Lifecycle:
 *  1. build() — bulk-load all embeddings from SQLite into the WASM index
 *  2. search() — fast Hamming scan → candidate ids → caller reranks
 *  3. rebuild() — called when entry count drifts >20% from last build
 */
/**
 * Build or rebuild the RaBitQ index from SQLite embeddings.
 * Returns entry count or 0 if RaBitQ is unavailable.
 */
export declare function buildRabitqIndex(options?: {
    dbPath?: string;
    dimensions?: number;
    force?: boolean;
}): Promise<{
    success: boolean;
    vectorCount: number;
    dimensions: number;
    compressionRatio: number;
    buildTimeMs: number;
    wasmVersion?: string;
    error?: string;
}>;
/**
 * Search the RaBitQ index for candidate IDs.
 * Returns null if index not built or unavailable.
 * Caller is responsible for reranking with exact similarity.
 */
export declare function searchRabitq(queryEmbedding: number[], options?: {
    k?: number;
    namespace?: string;
}): Promise<Array<{
    id: string;
    key: string;
    namespace: string;
    distance: number;
    position: number;
}> | null>;
/**
 * Check if the RaBitQ index needs rebuilding.
 */
export declare function shouldRebuildRabitq(currentEntryCount: number): Promise<boolean>;
/**
 * Get RaBitQ index status.
 */
export declare function getRabitqStatus(): {
    available: boolean;
    initialized: boolean;
    vectorCount: number;
    dimensions: number;
    builtAt: number | null;
    compressionRatio: number;
};
//# sourceMappingURL=rabitq-index.d.ts.map