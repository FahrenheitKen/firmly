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
export var CircuitBreakerState;
(function (CircuitBreakerState) {
    /** Circuit is closed, requests flow normally */
    CircuitBreakerState["CLOSED"] = "CLOSED";
    /** Circuit is open, requests are rejected immediately */
    CircuitBreakerState["OPEN"] = "OPEN";
    /** Circuit is testing if service recovered */
    CircuitBreakerState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitBreakerState || (CircuitBreakerState = {}));
/**
 * Default options
 */
const DEFAULT_OPTIONS = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    rollingWindow: 60000,
    volumeThreshold: 10,
};
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
export class CircuitBreaker extends EventEmitter {
    options;
    state = CircuitBreakerState.CLOSED;
    requests = [];
    halfOpenSuccesses = 0;
    openedAt = null;
    lastFailure = null;
    lastSuccess = null;
    rejectedCount = 0;
    timeoutId;
    constructor(options) {
        super();
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    /**
     * Execute a function through the circuit breaker
     */
    async execute(fn) {
        // Clean up old requests
        this.cleanOldRequests();
        // Check if circuit should be tested
        this.checkState();
        // If open, reject immediately or use fallback
        if (this.state === CircuitBreakerState.OPEN) {
            this.rejectedCount++;
            const error = new Error(`Circuit breaker '${this.options.name}' is open`);
            if (this.options.fallback) {
                return this.options.fallback(error);
            }
            throw error;
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            // Check if this should be counted as failure
            const isFailure = this.options.isFailure?.(err) ?? true;
            if (isFailure) {
                this.onFailure(err);
            }
            throw error;
        }
    }
    /**
     * Get current state
     */
    getState() {
        this.checkState();
        return this.state;
    }
    /**
     * Get statistics
     */
    getStats() {
        this.cleanOldRequests();
        return {
            state: this.state,
            failures: this.requests.filter((r) => !r.success).length,
            successes: this.requests.filter((r) => r.success).length,
            totalRequests: this.requests.length,
            rejectedRequests: this.rejectedCount,
            lastFailure: this.lastFailure,
            lastSuccess: this.lastSuccess,
            openSince: this.openedAt,
        };
    }
    /**
     * Force reset the circuit breaker
     */
    reset() {
        const previousState = this.state;
        this.state = CircuitBreakerState.CLOSED;
        this.requests = [];
        this.halfOpenSuccesses = 0;
        this.openedAt = null;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
        if (previousState !== this.state) {
            this.notifyStateChange(previousState, this.state);
        }
    }
    /**
     * Handle successful request
     */
    onSuccess() {
        this.lastSuccess = new Date();
        this.requests.push({ timestamp: Date.now(), success: true });
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.halfOpenSuccesses++;
            if (this.halfOpenSuccesses >= this.options.successThreshold) {
                this.transitionTo(CircuitBreakerState.CLOSED);
                this.halfOpenSuccesses = 0;
            }
        }
    }
    /**
     * Handle failed request
     */
    onFailure(error) {
        this.lastFailure = new Date();
        this.requests.push({ timestamp: Date.now(), success: false });
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            // Failed during half-open, go back to open
            this.transitionTo(CircuitBreakerState.OPEN);
            this.halfOpenSuccesses = 0;
            return;
        }
        // Check if we should open the circuit
        const failures = this.requests.filter((r) => !r.success).length;
        const totalRequests = this.requests.length;
        if (totalRequests >= this.options.volumeThreshold &&
            failures >= this.options.failureThreshold) {
            this.transitionTo(CircuitBreakerState.OPEN);
        }
    }
    /**
     * Check if state should change based on timeout
     */
    checkState() {
        if (this.state === CircuitBreakerState.OPEN && this.openedAt) {
            const elapsed = Date.now() - this.openedAt.getTime();
            if (elapsed >= this.options.timeout) {
                this.transitionTo(CircuitBreakerState.HALF_OPEN);
            }
        }
    }
    /**
     * Transition to new state
     */
    transitionTo(newState) {
        const previousState = this.state;
        if (previousState === newState) {
            return;
        }
        this.state = newState;
        if (newState === CircuitBreakerState.OPEN) {
            this.openedAt = new Date();
            this.scheduleHalfOpen();
        }
        else if (newState === CircuitBreakerState.CLOSED) {
            this.openedAt = null;
            this.requests = [];
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = undefined;
            }
        }
        this.notifyStateChange(previousState, newState);
    }
    /**
     * Schedule transition to half-open
     */
    scheduleHalfOpen() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.timeoutId = setTimeout(() => {
            if (this.state === CircuitBreakerState.OPEN) {
                this.transitionTo(CircuitBreakerState.HALF_OPEN);
            }
        }, this.options.timeout);
    }
    /**
     * Notify state change
     */
    notifyStateChange(from, to) {
        this.emit('stateChange', { from, to });
        this.options.onStateChange?.(from, to);
    }
    /**
     * Clean old requests outside rolling window
     */
    cleanOldRequests() {
        const cutoff = Date.now() - this.options.rollingWindow;
        this.requests = this.requests.filter((r) => r.timestamp >= cutoff);
    }
}
//# sourceMappingURL=circuit-breaker.js.map