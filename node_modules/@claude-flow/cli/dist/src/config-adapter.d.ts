/**
 * Configuration Adapter
 * Converts between SystemConfig and V3Config types
 */
import type { SystemConfig } from '@claude-flow/shared';
import type { V3Config } from './types.js';
/**
 * Convert SystemConfig to V3Config (CLI-specific format)
 */
export declare function systemConfigToV3Config(systemConfig: SystemConfig): V3Config;
/**
 * Convert V3Config to SystemConfig
 */
export declare function v3ConfigToSystemConfig(v3Config: V3Config): Partial<SystemConfig>;
//# sourceMappingURL=config-adapter.d.ts.map