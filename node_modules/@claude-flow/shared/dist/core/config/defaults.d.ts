/**
 * V3 Default Configuration Values
 */
import type { AgentConfig, TaskConfig, SwarmConfig, MemoryConfig, MCPServerConfig, OrchestratorConfig, SystemConfig } from './schema.js';
/**
 * Default agent configuration
 */
export declare const defaultAgentConfig: Partial<AgentConfig>;
/**
 * Default task configuration
 */
export declare const defaultTaskConfig: Partial<TaskConfig>;
/**
 * Default swarm configuration (core version)
 */
export declare const defaultSwarmConfigCore: SwarmConfig;
/**
 * Default memory configuration (hybrid backend - ADR-009)
 */
export declare const defaultMemoryConfig: MemoryConfig;
/**
 * Default MCP server configuration
 */
export declare const defaultMCPServerConfig: MCPServerConfig;
/**
 * Default orchestrator configuration
 */
export declare const defaultOrchestratorConfig: OrchestratorConfig;
/**
 * Default full system configuration
 */
export declare const defaultSystemConfig: SystemConfig;
/**
 * Agent type presets
 */
export declare const agentTypePresets: Record<string, Partial<AgentConfig>>;
/**
 * Get merged configuration with defaults
 */
export declare function mergeWithDefaults<T extends Record<string, unknown>>(config: Partial<T>, defaults: T): T;
//# sourceMappingURL=defaults.d.ts.map