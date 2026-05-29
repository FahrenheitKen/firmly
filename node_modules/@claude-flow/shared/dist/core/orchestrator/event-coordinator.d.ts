/**
 * V3 Event Coordinator
 * Decomposed from orchestrator.ts - Event routing
 * ~100 lines (target achieved)
 */
import type { IEvent, IEventBus, IEventHandler, IEventCoordinator } from '../interfaces/event.interface.js';
/**
 * Event coordinator implementation
 */
export declare class EventCoordinator implements IEventCoordinator {
    private eventBus;
    private handlers;
    private initialized;
    constructor(eventBus: IEventBus);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    route(event: IEvent): Promise<void>;
    registerHandler(type: string, handler: IEventHandler): void;
    unregisterHandler(type: string, handler: IEventHandler): void;
    getEventBus(): IEventBus;
    private registerSystemHandlers;
    /**
     * Get registered handler count for a type
     */
    getHandlerCount(type: string): number;
    /**
     * Get all registered event types
     */
    getRegisteredTypes(): string[];
    /**
     * Check if coordinator is initialized
     */
    isInitialized(): boolean;
}
//# sourceMappingURL=event-coordinator.d.ts.map