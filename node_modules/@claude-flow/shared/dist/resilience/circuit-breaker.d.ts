/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by breaking the circuit after failures.
 *
 * @module v3/shared/resilience/circuit-breaker
 */
import { EventEmitter } from 'events';
/**
 * Circuit breaker states
 */
export declare enum CircuitBreakerState {
    /** Circuit is closed, requests flow normally */
    CLOSED = "CLOSED",
    /** Circuit is open, requests are rejected immediately */
    OPEN = "OPEN",
    /** Circuit is testing if service recovered */
    HALF_OPEN = "HALF_OPEN"
}
/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
    /** Name for identification */
    name: string;
    /** Failure threshold before opening circuit (default: 5) */
    failureThreshold: number;
    /** Success threshold in half-open state to close circuit (default: 3) */
    successThreshold: number;
    /** Time to wait before testing again in ms (default: 30000) */
    timeout: number;
    /** Time window to track failures in ms (default: 60000) */
    rollingWindow: number;
    /** Volume threshold - minimum requests before tripping (default: 10) */
    volumeThreshold: number;
    /** Custom failure detection */
    isFailure?: (error: Error) => boolean;
    /** Fallback function when circuit is open */
    fallback?: <T>(error: Error) => T | Promise<T>;
    /** Callback when state changes */
    onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;
}
/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    totalRequests: number;
    rejectedRequests: number;
    lastFailure: Date | null;
    lastSuccess: Date | null;
    openSince: Date | null;
}
/**
 * Circuit Breaker
 *
 * Implements the circuit breaker pattern to prevent cascading failures.
 *
 * @example
 * const breaker = new CircuitBreaker({
 *   name: 'external-api',
 *   failureThreshold: 5,
 *   timeout: 30000,
 * });
 *
 * try {
 *   const result = await breaker.execute(() => fetchExternalAPI());
 * } catch (error) {
 *   if (error.message === 'Circuit is open') {
 *     // Handle circuit open case
 *   }
 * }
 */
export declare class CircuitBreaker extends EventEmitter {
    private readonly options;
    private state;
    private requests;
    private halfOpenSuccesses;
    private openedAt;
    private lastFailure;
    private lastSuccess;
    private rejectedCount;
    private timeoutId?;
    constructor(options: CircuitBreakerOptions);
    /**
     * Execute a function through the circuit breaker
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Get current state
     */
    getState(): CircuitBreakerState;
    /**
     * Get statistics
     */
    getStats(): CircuitBreakerStats;
    /**
     * Force reset the circuit breaker
     */
    reset(): void;
    /**
     * Handle successful request
     */
    private onSuccess;
    /**
     * Handle failed request
     */
    private onFailure;
    /**
     * Check if state should change based on timeout
     */
    private checkState;
    /**
     * Transition to new state
     */
    private transitionTo;
    /**
     * Schedule transition to half-open
     */
    private scheduleHalfOpen;
    /**
     * Notify state change
     */
    private notifyStateChange;
    /**
     * Clean old requests outside rolling window
     */
    private cleanOldRequests;
}
//# sourceMappingURL=circuit-breaker.d.ts.map