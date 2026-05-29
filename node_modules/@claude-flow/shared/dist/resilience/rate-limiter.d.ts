/**
 * Rate Limiter
 *
 * Production-ready rate limiting implementations.
 *
 * @module v3/shared/resilience/rate-limiter
 */
/**
 * Rate limiter options
 */
export interface RateLimiterOptions {
    /** Maximum requests allowed in the window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Enable sliding window (vs fixed window) */
    slidingWindow?: boolean;
    /** Key generator for per-key limiting */
    keyGenerator?: (context: unknown) => string;
    /** Skip limiter for certain requests */
    skip?: (context: unknown) => boolean;
    /** Handler when rate limit is exceeded */
    onRateLimited?: (key: string, remaining: number, resetAt: Date) => void;
}
/**
 * Rate limit result
 */
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter: number;
    total: number;
    used: number;
}
/**
 * Base Rate Limiter interface
 */
export interface RateLimiter {
    /** Check if request is allowed */
    check(key?: string): RateLimitResult;
    /** Consume a request token */
    consume(key?: string): RateLimitResult;
    /** Reset a specific key or all keys */
    reset(key?: string): void;
    /** Get current status */
    status(key?: string): RateLimitResult;
}
/**
 * Sliding Window Rate Limiter
 *
 * Uses sliding window algorithm for smooth rate limiting.
 *
 * @example
 * const limiter = new SlidingWindowRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000, // 100 requests per minute
 * });
 *
 * const result = limiter.consume('user-123');
 * if (!result.allowed) {
 *   throw new Error(`Rate limited. Retry in ${result.retryAfter}ms`);
 * }
 */
export declare class SlidingWindowRateLimiter implements RateLimiter {
    private readonly options;
    private readonly requests;
    private cleanupInterval?;
    constructor(options: RateLimiterOptions);
    /**
     * Check if a request would be allowed without consuming
     */
    check(key?: string): RateLimitResult;
    /**
     * Consume a request token
     */
    consume(key?: string): RateLimitResult;
    /**
     * Reset rate limit for a key
     */
    reset(key?: string): void;
    /**
     * Get current status
     */
    status(key?: string): RateLimitResult;
    /**
     * Cleanup resources
     */
    destroy(): void;
    /**
     * Clean old entries for a specific key
     */
    private cleanupKey;
    /**
     * Clean all old entries
     */
    private cleanup;
    /**
     * Get reset time based on oldest entry
     */
    private getResetTime;
    /**
     * Get retry after time in ms
     */
    private getRetryAfter;
}
/**
 * Token Bucket Rate Limiter
 *
 * Uses token bucket algorithm for burst-friendly rate limiting.
 *
 * @example
 * const limiter = new TokenBucketRateLimiter({
 *   maxRequests: 10, // bucket size
 *   windowMs: 1000,  // refill interval
 * });
 */
export declare class TokenBucketRateLimiter implements RateLimiter {
    private readonly options;
    private readonly buckets;
    private cleanupInterval?;
    constructor(options: RateLimiterOptions);
    /**
     * Check if a request would be allowed
     */
    check(key?: string): RateLimitResult;
    /**
     * Consume a token
     */
    consume(key?: string): RateLimitResult;
    /**
     * Reset bucket for a key
     */
    reset(key?: string): void;
    /**
     * Get current status
     */
    status(key?: string): RateLimitResult;
    /**
     * Cleanup resources
     */
    destroy(): void;
    /**
     * Get or create bucket for key
     */
    private getBucket;
    /**
     * Refill tokens based on elapsed time
     */
    private refill;
    /**
     * Clean inactive buckets
     */
    private cleanup;
}
/**
 * Rate limiter middleware for Express-like frameworks
 */
export declare function createRateLimiterMiddleware(limiter: RateLimiter): (req: {
    ip?: string;
    headers?: Record<string, string>;
}, res: {
    status: (code: number) => {
        json: (body: unknown) => void;
    };
    setHeader: (name: string, value: string) => void;
}, next: () => void) => void;
//# sourceMappingURL=rate-limiter.d.ts.map