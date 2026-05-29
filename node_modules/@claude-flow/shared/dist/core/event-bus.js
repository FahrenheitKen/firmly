/**
 * V3 Event Bus
 * Core event pub/sub implementation
 */
import { randomBytes } from 'crypto';
// Secure event ID generation
function generateSecureEventId() {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(12).toString('hex');
    return `evt_${timestamp}_${random}`;
}
/**
 * Event subscription implementation
 */
class EventSubscription {
    id;
    filter;
    removeCallback;
    active = true;
    paused = false;
    constructor(id, filter, removeCallback) {
        this.id = id;
        this.filter = filter;
        this.removeCallback = removeCallback;
    }
    unsubscribe() {
        this.active = false;
        this.removeCallback();
    }
    pause() {
        this.paused = true;
    }
    resume() {
        this.paused = false;
    }
    isActive() {
        return this.active && !this.paused;
    }
}
/**
 * Event bus implementation
 */
export class EventBus {
    handlers = new Map();
    subscriptions = new Map();
    subscriptionId = 0;
    emit(type, payload, options) {
        const event = this.createEvent(type, payload, options);
        this.dispatchEvent(event);
    }
    async emitAsync(type, payload, options) {
        const event = this.createEvent(type, payload, options);
        await this.dispatchEventAsync(event);
    }
    on(type, handler) {
        return this.subscribe({ types: [type] }, handler);
    }
    subscribe(filter, handler) {
        const id = `sub_${++this.subscriptionId}`;
        // Register for all matching types
        const types = filter.types ?? ['*'];
        for (const type of types) {
            let handlers = this.handlers.get(type);
            if (!handlers) {
                handlers = new Set();
                this.handlers.set(type, handlers);
            }
            handlers.add(handler);
        }
        const subscription = new EventSubscription(id, filter, () => {
            this.removeSubscription(id);
        });
        this.subscriptions.set(id, { filter, handler: handler, subscription });
        return subscription;
    }
    once(type, handler) {
        const wrappedHandler = async (event) => {
            subscription.unsubscribe();
            await handler(event);
        };
        const subscription = this.on(type, wrappedHandler);
        return subscription;
    }
    off(type, handler) {
        const handlers = this.handlers.get(type);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.handlers.delete(type);
            }
        }
    }
    removeAllListeners(type) {
        if (type) {
            this.handlers.delete(type);
        }
        else {
            this.handlers.clear();
        }
    }
    listenerCount(type) {
        return this.handlers.get(type)?.size ?? 0;
    }
    eventNames() {
        return Array.from(this.handlers.keys());
    }
    createEvent(type, payload, options) {
        return {
            id: generateSecureEventId(),
            type,
            timestamp: new Date(),
            source: options?.source ?? 'event-bus',
            payload,
            priority: options?.priority,
            correlationId: options?.correlationId,
            causationId: options?.causationId,
            metadata: options?.metadata,
        };
    }
    dispatchEvent(event) {
        // Get handlers for specific type
        const typeHandlers = this.handlers.get(event.type);
        // Get wildcard handlers
        const wildcardHandlers = this.handlers.get('*');
        const allHandlers = new Set();
        if (typeHandlers) {
            for (const handler of typeHandlers) {
                allHandlers.add(handler);
            }
        }
        if (wildcardHandlers) {
            for (const handler of wildcardHandlers) {
                allHandlers.add(handler);
            }
        }
        for (const handler of allHandlers) {
            try {
                const result = handler(event);
                if (result instanceof Promise) {
                    result.catch((error) => {
                        console.error(`Error in async event handler for ${event.type}:`, error);
                    });
                }
            }
            catch (error) {
                console.error(`Error in event handler for ${event.type}:`, error);
            }
        }
    }
    async dispatchEventAsync(event) {
        const typeHandlers = this.handlers.get(event.type);
        const wildcardHandlers = this.handlers.get('*');
        const allHandlers = new Set();
        if (typeHandlers) {
            for (const handler of typeHandlers) {
                allHandlers.add(handler);
            }
        }
        if (wildcardHandlers) {
            for (const handler of wildcardHandlers) {
                allHandlers.add(handler);
            }
        }
        const promises = Array.from(allHandlers).map(async (handler) => {
            try {
                await handler(event);
            }
            catch (error) {
                console.error(`Error in event handler for ${event.type}:`, error);
            }
        });
        await Promise.allSettled(promises);
    }
    removeSubscription(id) {
        const sub = this.subscriptions.get(id);
        if (sub) {
            const types = sub.filter.types ?? ['*'];
            for (const type of types) {
                const handlers = this.handlers.get(type);
                if (handlers) {
                    handlers.delete(sub.handler);
                    if (handlers.size === 0) {
                        this.handlers.delete(type);
                    }
                }
            }
            this.subscriptions.delete(id);
        }
    }
}
/**
 * Create a new event bus instance
 */
export function createEventBus() {
    return new EventBus();
}
//# sourceMappingURL=event-bus.js.map