/**
 * V3 Core Module - Public API
 * Domain-Driven Design with Clean Architecture
 *
 * This module provides the core architecture for claude-flow v3:
 * - Decomposed orchestrator (task, session, health, lifecycle management)
 * - Event-driven architecture with event bus and coordinator
 * - Type-safe configuration with Zod validation
 * - Clean interfaces following DDD principles
 */
export * from './interfaces/index.js';
export { EventBus, createEventBus } from './event-bus.js';
export * from './orchestrator/index.js';
export * from './config/index.js';
//# sourceMappingURL=index.d.ts.map