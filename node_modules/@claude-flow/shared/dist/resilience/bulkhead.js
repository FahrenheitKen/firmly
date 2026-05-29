/**
 * Bulkhead Pattern
 *
 * Isolates failures by limiting concurrent executions.
 *
 * @module v3/shared/resilience/bulkhead
 */
import { EventEmitter } from 'events';
/**
 * Default options
 */
const DEFAULT_OPTIONS = {
    maxConcurrent: 10,
    maxQueue: 100,
    queueTimeout: 30000,
};
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
export class Bulkhead extends EventEmitter {
    options;
    active = 0;
    queue = [];
    completed = 0;
    rejected = 0;
    timedOut = 0;
    constructor(options) {
        super();
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    /**
     * Execute a function within the bulkhead
     */
    async execute(fn) {
        // If there's room for execution, run immediately
        if (this.active < this.options.maxConcurrent) {
            return this.runNow(fn);
        }
        // Check if queue is full
        if (this.queue.length >= this.options.maxQueue) {
            this.rejected++;
            this.options.onRejected?.('full');
            throw new Error(`Bulkhead '${this.options.name}' is full. Max concurrent: ${this.options.maxConcurrent}, queue: ${this.options.maxQueue}`);
        }
        // Add to queue
        return this.addToQueue(fn);
    }
    /**
     * Get current statistics
     */
    getStats() {
        return {
            active: this.active,
            queued: this.queue.length,
            maxConcurrent: this.options.maxConcurrent,
            maxQueue: this.options.maxQueue,
            completed: this.completed,
            rejected: this.rejected,
            timedOut: this.timedOut,
        };
    }
    /**
     * Check if there's capacity available
     */
    hasCapacity() {
        return this.active < this.options.maxConcurrent || this.queue.length < this.options.maxQueue;
    }
    /**
     * Get available capacity (concurrent + queue)
     */
    availableCapacity() {
        const concurrentAvailable = this.options.maxConcurrent - this.active;
        const queueAvailable = this.options.maxQueue - this.queue.length;
        return concurrentAvailable + queueAvailable;
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.completed = 0;
        this.rejected = 0;
        this.timedOut = 0;
    }
    /**
     * Run function immediately
     */
    async runNow(fn) {
        this.active++;
        this.emit('acquire');
        try {
            const result = await fn();
            this.completed++;
            return result;
        }
        finally {
            this.active--;
            this.emit('release');
            this.processQueue();
        }
    }
    /**
     * Add function to queue
     */
    addToQueue(fn) {
        return new Promise((resolve, reject) => {
            const item = {
                fn,
                resolve,
                reject,
                queuedAt: Date.now(),
            };
            // Set timeout for queued item
            item.timeoutId = setTimeout(() => {
                const index = this.queue.indexOf(item);
                if (index !== -1) {
                    this.queue.splice(index, 1);
                    this.timedOut++;
                    this.options.onRejected?.('timeout');
                    reject(new Error(`Bulkhead '${this.options.name}' queue timeout after ${this.options.queueTimeout}ms`));
                }
            }, this.options.queueTimeout);
            this.queue.push(item);
            this.emit('queued', { queueLength: this.queue.length });
        });
    }
    /**
     * Process next item in queue
     */
    processQueue() {
        if (this.active >= this.options.maxConcurrent) {
            return;
        }
        const item = this.queue.shift();
        if (!item) {
            return;
        }
        // Clear timeout
        if (item.timeoutId) {
            clearTimeout(item.timeoutId);
        }
        // Execute the queued function
        this.active++;
        this.emit('acquire');
        item.fn()
            .then((result) => {
            this.completed++;
            item.resolve(result);
        })
            .catch((error) => {
            item.reject(error);
        })
            .finally(() => {
            this.active--;
            this.emit('release');
            this.processQueue();
        });
    }
}
/**
 * Create a semaphore for limiting concurrent access
 */
export function createSemaphore(maxConcurrent) {
    let current = 0;
    const waiting = [];
    return {
        async acquire() {
            if (current < maxConcurrent) {
                current++;
                return;
            }
            return new Promise((resolve) => {
                waiting.push(resolve);
            });
        },
        release() {
            const next = waiting.shift();
            if (next) {
                next();
            }
            else {
                current = Math.max(0, current - 1);
            }
        },
        available() {
            return maxConcurrent - current;
        },
    };
}
//# sourceMappingURL=bulkhead.js.map