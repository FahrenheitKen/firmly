/**
 * Retry with Exponential Backoff
 *
 * Production-ready retry logic with jitter, max retries, and error filtering.
 *
 * @module v3/shared/resilience/retry
 */
/**
 * Retry options
 */
export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxAttempts: number;
    /** Initial delay in milliseconds (default: 100) */
    initialDelay: number;
    /** Maximum delay in milliseconds (default: 10000) */
    maxDelay: number;
    /** Backoff multiplier (default: 2) */
    backoffMultiplier: number;
    /** Jitter factor 0-1 to randomize delays (default: 0.1) */
    jitter: number;
    /** Timeout for each attempt in milliseconds (default: 30000) */
    timeout: number;
    /** Errors that should trigger a retry (default: all errors) */
    retryableErrors?: (error: Error) => boolean;
    /** Callback for each retry attempt */
    onRetry?: (error: Error, attempt: number, delay: number) => void;
}
/**
 * Retry result
 */
export interface RetryResult<T> {
    success: boolean;
    result?: T;
    attempts: number;
    totalTime: number;
    errors: Error[];
}
/**
 * Retry error with attempt history
 */
export declare class RetryError extends Error {
    readonly attempts: number;
    readonly errors: Error[];
    readonly totalTime: number;
    constructor(message: string, attempts: number, errors: Error[], totalTime: number);
}
/**
 * Retry a function with exponential backoff
 *
 * @param fn Function to retry
 * @param options Retry configuration
 * @returns Result with success/failure and metadata
 *
 * @example
 * const result = await retry(
 *   () => fetchData(),
 *   { maxAttempts: 5, initialDelay: 200 }
 * );
 *
 * if (result.success) {
 *   console.log('Data:', result.result);
 * } else {
 *   console.log('Failed after', result.attempts, 'attempts');
 * }
 */
export declare function retry<T>(fn: () => Promise<T>, options?: Partial<RetryOptions>): Promise<RetryResult<T>>;
/**
 * Wrap a function with retry behavior
 *
 * @param fn Function to wrap
 * @param options Retry configuration
 * @returns Wrapped function that retries on failure
 */
export declare function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, options?: Partial<RetryOptions>): (...args: Parameters<T>) => Promise<RetryResult<Awaited<ReturnType<T>>>>;
/**
 * Common retryable error predicates
 */
export declare const RetryableErrors: {
    /** Network errors (ECONNRESET, ETIMEDOUT, etc.) */
    network: (error: Error) => boolean;
    /** Rate limit errors (429) */
    rateLimit: (error: Error) => boolean;
    /** Server errors (5xx) */
    serverError: (error: Error) => boolean;
    /** Transient errors (network + rate limit + 5xx) */
    transient: (error: Error) => boolean;
    /** All errors are retryable */
    all: () => boolean;
};
//# sourceMappingURL=retry.d.ts.map