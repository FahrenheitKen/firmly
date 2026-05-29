/**
 * V3 Configuration Validator
 * Validation logic using Zod schemas
 */
import { z } from 'zod';
import { AgentConfigSchema, TaskConfigSchema, SwarmConfigSchema, MemoryConfigSchema, MCPServerConfigSchema, OrchestratorConfigSchema, SystemConfigSchema, } from './schema.js';
/**
 * Convert Zod error to validation errors
 */
function zodErrorToValidationErrors(error) {
    return error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
    }));
}
/**
 * Generic validation function
 * Uses parse + try/catch to get output types with defaults applied
 */
function validate(schema, data) {
    try {
        const parsed = schema.parse(data);
        return {
            success: true,
            data: parsed,
        };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                errors: zodErrorToValidationErrors(error),
            };
        }
        throw error;
    }
}
/**
 * Validate agent configuration
 */
export function validateAgentConfig(data) {
    return validate(AgentConfigSchema, data);
}
/**
 * Validate task configuration
 */
export function validateTaskConfig(data) {
    return validate(TaskConfigSchema, data);
}
/**
 * Validate swarm configuration
 */
export function validateSwarmConfig(data) {
    return validate(SwarmConfigSchema, data);
}
/**
 * Validate memory configuration
 */
export function validateMemoryConfig(data) {
    return validate(MemoryConfigSchema, data);
}
/**
 * Validate MCP server configuration
 */
export function validateMCPServerConfig(data) {
    return validate(MCPServerConfigSchema, data);
}
/**
 * Validate orchestrator configuration
 */
export function validateOrchestratorConfig(data) {
    return validate(OrchestratorConfigSchema, data);
}
/**
 * Validate full system configuration
 */
export function validateSystemConfig(data) {
    return validate(SystemConfigSchema, data);
}
/**
 * Configuration validator class
 */
export class ConfigValidator {
    /**
     * Validate and throw on error
     */
    static validateOrThrow(schema, data, configName) {
        const result = validate(schema, data);
        if (!result.success) {
            const errorMessages = result.errors
                ?.map((e) => `  - ${e.path}: ${e.message}`)
                .join('\n');
            throw new Error(`Invalid ${configName} configuration:\n${errorMessages}`);
        }
        return result.data;
    }
    /**
     * Validate agent config or throw
     */
    static validateAgentOrThrow(data) {
        return this.validateOrThrow(AgentConfigSchema, data, 'agent');
    }
    /**
     * Validate task config or throw
     */
    static validateTaskOrThrow(data) {
        return this.validateOrThrow(TaskConfigSchema, data, 'task');
    }
    /**
     * Validate swarm config or throw
     */
    static validateSwarmOrThrow(data) {
        return this.validateOrThrow(SwarmConfigSchema, data, 'swarm');
    }
    /**
     * Validate memory config or throw
     */
    static validateMemoryOrThrow(data) {
        return this.validateOrThrow(MemoryConfigSchema, data, 'memory');
    }
    /**
     * Validate MCP server config or throw
     */
    static validateMCPServerOrThrow(data) {
        return this.validateOrThrow(MCPServerConfigSchema, data, 'MCP server');
    }
    /**
     * Validate orchestrator config or throw
     */
    static validateOrchestratorOrThrow(data) {
        return this.validateOrThrow(OrchestratorConfigSchema, data, 'orchestrator');
    }
    /**
     * Validate system config or throw
     */
    static validateSystemOrThrow(data) {
        return this.validateOrThrow(SystemConfigSchema, data, 'system');
    }
    /**
     * Check if data matches schema
     */
    static isValid(schema, data) {
        return validate(schema, data).success;
    }
}
//# sourceMappingURL=validator.js.map