/**
 * V3 Event Coordinator
 * Decomposed from orchestrator.ts - Event routing
 * ~100 lines (target achieved)
 */
import { SystemEventTypes } from '../interfaces/event.interface.js';
/**
 * Event coordinator implementation
 */
export class EventCoordinator {
    eventBus;
    handlers = new Map();
    initialized = false;
    constructor(eventBus) {
        this.eventBus = eventBus;
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        // Register default system event handlers
        this.registerSystemHandlers();
        this.initialized = true;
    }
    async shutdown() {
        // Clear all handlers
        this.handlers.clear();
        this.initialized = false;
    }
    async route(event) {
        const handlers = this.handlers.get(event.type);
        if (!handlers || handlers.size === 0) {
            return;
        }
        const handlerPromises = Array.from(handlers).map(async (handler) => {
            try {
                await handler(event);
            }
            catch (error) {
                // Log error but don't throw
                console.error(`Error in event handler for ${event.type}:`, error);
            }
        });
        await Promise.allSettled(handlerPromises);
    }
    registerHandler(type, handler) {
        let handlers = this.handlers.get(type);
        if (!handlers) {
            handlers = new Set();
            this.handlers.set(type, handlers);
        }
        handlers.add(handler);
        // Also register with event bus
        this.eventBus.on(type, handler);
    }
    unregisterHandler(type, handler) {
        const handlers = this.handlers.get(type);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.handlers.delete(type);
            }
        }
        // Also unregister from event bus
        this.eventBus.off(type, handler);
    }
    getEventBus() {
        return this.eventBus;
    }
    registerSystemHandlers() {
        // Error handling
        this.eventBus.on(SystemEventTypes.SYSTEM_ERROR, (event) => {
            const { error, component } = event.payload;
            console.error(`System error in ${component}:`, error);
        });
        // Deadlock detection
        this.eventBus.on(SystemEventTypes.DEADLOCK_DETECTED, (event) => {
            const { agents, resources } = event.payload;
            console.warn('Deadlock detected:', { agents, resources });
        });
    }
    /**
     * Get registered handler count for a type
     */
    getHandlerCount(type) {
        return this.handlers.get(type)?.size ?? 0;
    }
    /**
     * Get all registered event types
     */
    getRegisteredTypes() {
        return Array.from(this.handlers.keys());
    }
    /**
     * Check if coordinator is initialized
     */
    isInitialized() {
        return this.initialized;
    }
}
//# sourceMappingURL=event-coordinator.js.map