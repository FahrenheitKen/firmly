/**
 * V3 Health Monitor
 * Decomposed from orchestrator.ts - Agent health checks
 * ~150 lines (target achieved)
 */
import { SystemEventTypes } from '../interfaces/event.interface.js';
/**
 * Health monitor implementation
 */
export class HealthMonitor {
    eventBus;
    config;
    checks = new Map();
    history = [];
    interval;
    listeners = [];
    running = false;
    constructor(eventBus, config = {
        checkInterval: 30000,
        historyLimit: 100,
        degradedThreshold: 1,
        unhealthyThreshold: 2,
    }) {
        this.eventBus = eventBus;
        this.config = config;
    }
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.interval = setInterval(async () => {
            const status = await this.getStatus();
            this.addToHistory(status);
            this.notifyListeners(status);
            this.eventBus.emit(SystemEventTypes.SYSTEM_HEALTHCHECK, { status });
        }, this.config.checkInterval);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        this.running = false;
    }
    async getStatus() {
        const components = {};
        let unhealthyCount = 0;
        let degradedCount = 0;
        const checkPromises = Array.from(this.checks.entries()).map(async ([name, check]) => {
            try {
                const result = await Promise.race([
                    check(),
                    this.timeout(5000, 'Health check timeout'),
                ]);
                const health = {
                    name,
                    status: result.healthy ? 'healthy' : 'unhealthy',
                    lastCheck: new Date(),
                    error: result.error,
                    metrics: result.metrics,
                };
                return { name, health };
            }
            catch (error) {
                return {
                    name,
                    health: {
                        name,
                        status: 'unhealthy',
                        lastCheck: new Date(),
                        error: error instanceof Error ? error.message : 'Unknown error',
                    },
                };
            }
        });
        const results = await Promise.allSettled(checkPromises);
        for (const result of results) {
            if (result.status === 'fulfilled') {
                const { name, health } = result.value;
                components[name] = health;
                if (health.status === 'unhealthy') {
                    unhealthyCount++;
                }
                else if (health.status === 'degraded') {
                    degradedCount++;
                }
            }
        }
        let overallStatus = 'healthy';
        if (unhealthyCount >= this.config.unhealthyThreshold) {
            overallStatus = 'unhealthy';
        }
        else if (unhealthyCount > 0 ||
            degradedCount >= this.config.degradedThreshold) {
            overallStatus = 'degraded';
        }
        return {
            status: overallStatus,
            components,
            timestamp: new Date(),
        };
    }
    registerCheck(name, check) {
        this.checks.set(name, check);
    }
    unregisterCheck(name) {
        this.checks.delete(name);
    }
    getHistory(limit) {
        const count = limit ?? this.config.historyLimit;
        return this.history.slice(-count);
    }
    onHealthChange(callback) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index !== -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
    addToHistory(status) {
        this.history.push(status);
        // Trim history to limit
        if (this.history.length > this.config.historyLimit) {
            this.history = this.history.slice(-this.config.historyLimit);
        }
    }
    notifyListeners(status) {
        for (const listener of this.listeners) {
            try {
                listener(status);
            }
            catch {
                // Ignore listener errors
            }
        }
    }
    timeout(ms, message) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message)), ms);
        });
    }
    /**
     * Get component health by name
     */
    async getComponentHealth(name) {
        const status = await this.getStatus();
        return status.components[name];
    }
    /**
     * Check if system is healthy
     */
    async isHealthy() {
        const status = await this.getStatus();
        return status.status === 'healthy';
    }
    /**
     * Get registered check names
     */
    getRegisteredChecks() {
        return Array.from(this.checks.keys());
    }
}
//# sourceMappingURL=health-monitor.js.map