/**
 * V3 Event Bus
 * Core event pub/sub implementation
 */
import type { IEventBus, IEventCreate, IEventHandler, IEventSubscription, IEventFilter } from './interfaces/event.interface.js';
/**
 * Event bus implementation
 */
export declare class EventBus implements IEventBus {
    private handlers;
    private subscriptions;
    private subscriptionId;
    emit<T = unknown>(type: string, payload: T, options?: Partial<IEventCreate<T>>): void;
    emitAsync<T = unknown>(type: string, payload: T, options?: Partial<IEventCreate<T>>): Promise<void>;
    on<T = unknown>(type: string, handler: IEventHandler<T>): IEventSubscription;
    subscribe<T = unknown>(filter: IEventFilter, handler: IEventHandler<T>): IEventSubscription;
    once<T = unknown>(type: string, handler: IEventHandler<T>): IEventSubscription;
    off(type: string, handler: IEventHandler): void;
    removeAllListeners(type?: string): void;
    listenerCount(type: string): number;
    eventNames(): string[];
    private createEvent;
    private dispatchEvent;
    private dispatchEventAsync;
    private removeSubscription;
}
/**
 * Create a new event bus instance
 */
export declare function createEventBus(): IEventBus;
//# sourceMappingURL=event-bus.d.ts.map