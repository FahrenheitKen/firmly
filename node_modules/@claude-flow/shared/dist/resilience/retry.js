/**
 * Retry with Exponential Backoff
 *
 * Production-ready retry logic with jitter, max retries, and error filtering.
 *
 * @module v3/shared/resilience/retry
 */
/**
 * Retry error with attempt history
 */
export class RetryError extends Error {
    attempts;
    errors;
    totalTime;
    constructor(message, attempts, errors, totalTime) {
        super(message);
        this.attempts = attempts;
        this.errors = errors;
        this.totalTime = totalTime;
        this.name = 'RetryError';
    }
}
/**
 * Default retry options
 */
const DEFAULT_OPTIONS = {
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: 0.1,
    timeout: 30000,
};
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
export async function retry(fn, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const errors = [];
    const startTime = Date.now();
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            // Execute with timeout
            const result = await withTimeout(fn(), opts.timeout, attempt);
            return {
                success: true,
                result,
                attempts: attempt,
                totalTime: Date.now() - startTime,
                errors,
            };
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            errors.push(err);
            // Check if error is retryable
            if (opts.retryableErrors && !opts.retryableErrors(err)) {
                return {
                    success: false,
                    attempts: attempt,
                    totalTime: Date.now() - startTime,
                    errors,
                };
            }
            // If this was the last attempt, don't delay
            if (attempt >= opts.maxAttempts) {
                break;
            }
            // Calculate delay with exponential backoff and jitter
            const baseDelay = opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1);
            const jitter = baseDelay * opts.jitter * (Math.random() * 2 - 1);
            const delay = Math.min(baseDelay + jitter, opts.maxDelay);
            // Callback before retry
            if (opts.onRetry) {
                opts.onRetry(err, attempt, delay);
            }
            // Wait before next attempt
            await sleep(delay);
        }
    }
    return {
        success: false,
        attempts: opts.maxAttempts,
        totalTime: Date.now() - startTime,
        errors,
    };
}
/**
 * Wrap a function with retry behavior
 *
 * @param fn Function to wrap
 * @param options Retry configuration
 * @returns Wrapped function that retries on failure
 */
export function withRetry(fn, options = {}) {
    return async (...args) => {
        return retry(() => fn(...args), options);
    };
}
/**
 * Execute with timeout
 */
async function withTimeout(promise, timeout, attempt) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Attempt ${attempt} timed out after ${timeout}ms`));
        }, timeout);
    });
    return Promise.race([promise, timeoutPromise]);
}
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Common retryable error predicates
 */
export const RetryableErrors = {
    /** Network errors (ECONNRESET, ETIMEDOUT, etc.) */
    network: (error) => {
        const networkCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'];
        return networkCodes.some((code) => error.message.includes(code));
    },
    /** Rate limit errors (429) */
    rateLimit: (error) => {
        return error.message.includes('429') || error.message.toLowerCase().includes('rate limit');
    },
    /** Server errors (5xx) */
    serverError: (error) => {
        return /5\d\d/.test(error.message) || error.message.includes('Internal Server Error');
    },
    /** Transient errors (network + rate limit + 5xx) */
    transient: (error) => {
        return (RetryableErrors.network(error) ||
            RetryableErrors.rateLimit(error) ||
            RetryableErrors.serverError(error));
    },
    /** All errors are retryable */
    all: () => true,
};
//# sourceMappingURL=retry.js.map