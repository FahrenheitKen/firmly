/**
 * DiskANN Vector Search Backend
 *
 * SSD-friendly approximate nearest neighbor search using Vamana graph.
 * Falls back gracefully to HNSW (@ruvector/router VectorDb) or
 * pure-JS cosine similarity when DiskANN is unavailable.
 *
 * @module v3/cli/ruvector/diskann-backend
 */
export interface DiskAnnConfig {
    dim: number;
    maxDegree?: number;
    buildBeam?: number;
    searchBeam?: number;
    alpha?: number;
    pqSubspaces?: number;
    storagePath?: string;
}
export interface SearchResult {
    id: string;
    distance: number;
    score: number;
}
export type VectorBackend = 'diskann' | 'hnsw' | 'cosine-js';
/**
 * Check if @ruvector/diskann is available
 */
export declare function isDiskAnnAvailable(): Promise<boolean>;
/**
 * Create or get a DiskANN index instance
 */
export declare function getDiskAnnIndex(config: DiskAnnConfig): Promise<{
    index: any;
    backend: VectorBackend;
}>;
/**
 * Get the active backend name
 */
export declare function getActiveBackend(): VectorBackend;
/**
 * Reset the index (for testing)
 */
export declare function resetIndex(): void;
/**
 * Insert a vector into the active backend
 */
export declare function insertVector(id: string, vector: Float32Array, config?: DiskAnnConfig): Promise<{
    backend: VectorBackend;
}>;
/**
 * Build the index (required for DiskANN before search)
 */
export declare function buildIndex(config?: DiskAnnConfig): Promise<void>;
/**
 * Search for k nearest neighbors
 */
export declare function searchVectors(query: Float32Array, k: number, config?: DiskAnnConfig): Promise<SearchResult[]>;
export interface BenchmarkResult {
    backend: VectorBackend;
    dim: number;
    vectorCount: number;
    insertTimeMs: number;
    buildTimeMs: number;
    searchTimeMs: number;
    searchesPerSecond: number;
    recall: number;
    memoryMB: number;
}
/**
 * Run a benchmark comparing available backends
 */
export declare function benchmark(opts?: {
    dim?: number;
    vectorCount?: number;
    k?: number;
    queries?: number;
}): Promise<BenchmarkResult[]>;
//# sourceMappingURL=diskann-backend.d.ts.map