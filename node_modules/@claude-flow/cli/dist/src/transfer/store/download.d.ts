/**
 * Pattern Download Service
 * Secure download and verification of patterns from IPFS
 */
import type { PatternEntry, DownloadOptions, DownloadResult, StoreConfig } from './types.js';
/**
 * Download progress callback
 */
export type DownloadProgressCallback = (progress: {
    bytesDownloaded: number;
    totalBytes: number;
    percentage: number;
}) => void;
/**
 * Pattern Downloader
 * Handles secure download and verification of patterns
 */
export declare class PatternDownloader {
    private config;
    private downloadCache;
    constructor(config?: Partial<StoreConfig>);
    /**
     * Download a pattern from IPFS
     */
    downloadPattern(pattern: PatternEntry, options?: DownloadOptions, onProgress?: DownloadProgressCallback): Promise<DownloadResult>;
    /**
     * Fetch content from IPFS gateway or GCS
     */
    private fetchFromIPFS;
    /**
     * Fetch content from Google Cloud Storage
     */
    private fetchFromGCS;
    /**
     * Verify content checksum
     */
    private verifyChecksum;
    /**
     * Verify content signature using crypto
     */
    private verifySignature;
    /**
     * Resolve output path for pattern
     */
    private resolveOutputPath;
    /**
     * Import downloaded pattern
     */
    private importPattern;
    /**
     * Clear download cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        count: number;
        totalSize: number;
    };
}
/**
 * Batch download multiple patterns
 */
export declare function batchDownload(patterns: PatternEntry[], options?: DownloadOptions, config?: Partial<StoreConfig>): Promise<DownloadResult[]>;
/**
 * Create downloader with default config
 */
export declare function createDownloader(config?: Partial<StoreConfig>): PatternDownloader;
//# sourceMappingURL=download.d.ts.map