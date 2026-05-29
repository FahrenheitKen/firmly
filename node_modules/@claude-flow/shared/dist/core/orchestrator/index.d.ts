/**
 * V3 Orchestrator Facade
 * Unified interface to decomposed orchestrator components
 * ~50 lines (target achieved)
 */
import { TaskManager } from './task-manager.js';
import { SessionManager, type SessionManagerConfig } from './session-manager.js';
import { HealthMonitor, type HealthMonitorConfig } from './health-monitor.js';
import { LifecycleManager, type LifecycleManagerConfig } from './lifecycle-manager.js';
import { EventCoordinator } from './event-coordinator.js';
import { EventBus } from '../event-bus.js';
export * from './task-manager.js';
export * from './session-manager.js';
export * from './health-monitor.js';
export * from './lifecycle-manager.js';
export * from './event-coordinator.js';
/**
 * Orchestrator facade configuration
 * (Note: For schema-validated config, use OrchestratorConfig from config/schema.ts)
 */
export interface OrchestratorFacadeConfig {
    session: SessionManagerConfig;
    health: HealthMonitorConfig;
    lifecycle: LifecycleManagerConfig;
}
/**
 * Default orchestrator facade configuration
 */
export declare const defaultOrchestratorFacadeConfig: OrchestratorFacadeConfig;
/**
 * Create orchestrator components
 */
export declare function createOrchestrator(config?: Partial<OrchestratorFacadeConfig>): {
    eventBus: EventBus;
    taskManager: TaskManager;
    sessionManager: SessionManager;
    healthMonitor: HealthMonitor;
    lifecycleManager: LifecycleManager;
    eventCoordinator: EventCoordinator;
    config: OrchestratorFacadeConfig;
};
/**
 * Orchestrator type for facade
 */
export type OrchestratorComponents = ReturnType<typeof createOrchestrator>;
//# sourceMappingURL=index.d.ts.map