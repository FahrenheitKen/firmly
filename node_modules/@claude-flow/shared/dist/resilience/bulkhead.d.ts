/**
 * Bulkhead Pattern
 *
 * Isolates failures by limiting concurrent executions.
 *
 * @module v3/shared/resilience/bulkhead
 */
import { EventEmitter } from 'events';
/**
 * Bulkhead options
 */
export interface BulkheadOptions {
    /** Name for identification */
    name: string;
    /** Maximum concurrent executions */
    maxConcurrent: number;
    /** Maximum queue size */
    maxQueue: number;
    /** Timeout for queued items in ms */
    queueTimeout: number;
    /** Callback when rejected */
    onRejected?: (reason: 'full' | 'timeout') => void;
}
/**
 * Bulkhead statistics
 */
export interface BulkheadStats {
    active: number;
    queued: number;
    maxConcurrent: number;
    maxQueue: number;
    completed: number;
    rejected: number;
    timedOut: number;
}
/**
 * Bulkhead
 *
 * Limits concurrent executions to prevent resource exhaustion.
 *
 * @example
 * const bulkhead = new Bulkhead({
 *   name: 'database',
 *   maxConcurrent: 10,
 *   maxQueue: 50,
 * });
 *
 * try {
 *   const result = await bulkhead.execute(() => dbQuery());
 * } catch (error) {
 *   if (error.message.includes('Bulkhead full')) {
 *     // Handle capacity exceeded
 *   }
 * }
 */
export declare class Bulkhead extends EventEmitter {
    private readonly options;
    private active;
    private readonly queue;
    private completed;
    private rejected;
    private timedOut;
    constructor(options: BulkheadOptions);
    /**
     * Execute a function within the bulkhead
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Get current statistics
     */
    getStats(): BulkheadStats;
    /**
     * Check if there's capacity available
     */
    hasCapacity(): boolean;
    /**
     * Get available capacity (concurrent + queue)
     */
    availableCapacity(): number;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Run function immediately
     */
    private runNow;
    /**
     * Add function to queue
     */
    private addToQueue;
    /**
     * Process next item in queue
     */
    private processQueue;
}
/**
 * Create a semaphore for limiting concurrent access
 */
export declare function createSemaphore(maxConcurrent: number): {
    acquire: () => Promise<void>;
    release: () => void;
    available: () => number;
};
//# sourceMappingURL=bulkhead.d.ts.map