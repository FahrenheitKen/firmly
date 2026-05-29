/**
 * V3 Configuration Validator
 * Validation logic using Zod schemas
 */
import { z } from 'zod';
import { type AgentConfig, type TaskConfig, type SwarmConfig, type MemoryConfig, type MCPServerConfig, type OrchestratorConfig, type SystemConfig } from './schema.js';
/**
 * Validation result
 */
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: ValidationError[];
}
/**
 * Validation error
 */
export interface ValidationError {
    path: string;
    message: string;
    code: string;
}
/**
 * Validate agent configuration
 */
export declare function validateAgentConfig(data: unknown): ValidationResult<AgentConfig>;
/**
 * Validate task configuration
 */
export declare function validateTaskConfig(data: unknown): ValidationResult<TaskConfig>;
/**
 * Validate swarm configuration
 */
export declare function validateSwarmConfig(data: unknown): ValidationResult<SwarmConfig>;
/**
 * Validate memory configuration
 */
export declare function validateMemoryConfig(data: unknown): ValidationResult<MemoryConfig>;
/**
 * Validate MCP server configuration
 */
export declare function validateMCPServerConfig(data: unknown): ValidationResult<MCPServerConfig>;
/**
 * Validate orchestrator configuration
 */
export declare function validateOrchestratorConfig(data: unknown): ValidationResult<OrchestratorConfig>;
/**
 * Validate full system configuration
 */
export declare function validateSystemConfig(data: unknown): ValidationResult<SystemConfig>;
/**
 * Configuration validator class
 */
export declare class ConfigValidator {
    /**
     * Validate and throw on error
     */
    static validateOrThrow<TInput, TOutput>(schema: z.ZodType<TOutput, z.ZodTypeDef, TInput>, data: unknown, configName: string): TOutput;
    /**
     * Validate agent config or throw
     */
    static validateAgentOrThrow(data: unknown): AgentConfig;
    /**
     * Validate task config or throw
     */
    static validateTaskOrThrow(data: unknown): TaskConfig;
    /**
     * Validate swarm config or throw
     */
    static validateSwarmOrThrow(data: unknown): SwarmConfig;
    /**
     * Validate memory config or throw
     */
    static validateMemoryOrThrow(data: unknown): MemoryConfig;
    /**
     * Validate MCP server config or throw
     */
    static validateMCPServerOrThrow(data: unknown): MCPServerConfig;
    /**
     * Validate orchestrator config or throw
     */
    static validateOrchestratorOrThrow(data: unknown): OrchestratorConfig;
    /**
     * Validate system config or throw
     */
    static validateSystemOrThrow(data: unknown): SystemConfig;
    /**
     * Check if data matches schema
     */
    static isValid<TInput, TOutput>(schema: z.ZodType<TOutput, z.ZodTypeDef, TInput>, data: unknown): boolean;
}
//# sourceMappingURL=validator.d.ts.map