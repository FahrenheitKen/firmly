/**
 * V3 MCP Tool Registry
 *
 * High-performance tool management with:
 * - Fast O(1) lookup using Map
 * - Category-based organization
 * - Tool validation on registration
 * - Dynamic registration/unregistration
 * - Caching for frequently used tools
 *
 * Performance Targets:
 * - Tool registration: <10ms
 * - Tool lookup: <1ms
 * - Tool validation: <5ms
 */
import { EventEmitter } from 'events';
import { MCPTool, JSONSchema, ToolHandler, ToolContext, ToolCallResult, ToolRegistrationOptions, ILogger } from './types.js';
/**
 * Tool metadata for enhanced lookup
 */
interface ToolMetadata {
    tool: MCPTool;
    registeredAt: Date;
    callCount: number;
    lastCalled?: Date;
    avgExecutionTime: number;
    errorCount: number;
}
/**
 * Tool search options
 */
interface ToolSearchOptions {
    category?: string;
    tags?: string[];
    deprecated?: boolean;
    cacheable?: boolean;
}
/**
 * Tool Registry
 *
 * Manages registration, lookup, and execution of MCP tools
 */
export declare class ToolRegistry extends EventEmitter {
    private readonly logger;
    private readonly tools;
    private readonly categoryIndex;
    private readonly tagIndex;
    private defaultContext?;
    private totalRegistrations;
    private totalLookups;
    private totalExecutions;
    constructor(logger: ILogger);
    /**
     * Register a tool
     */
    register(tool: MCPTool, options?: ToolRegistrationOptions): boolean;
    /**
     * Register multiple tools at once
     */
    registerBatch(tools: MCPTool[], options?: ToolRegistrationOptions): {
        registered: number;
        failed: string[];
    };
    /**
     * Unregister a tool
     */
    unregister(name: string): boolean;
    /**
     * Get a tool by name
     */
    getTool(name: string): MCPTool | undefined;
    /**
     * Check if a tool exists
     */
    hasTool(name: string): boolean;
    /**
     * Get tool count
     */
    getToolCount(): number;
    /**
     * Get all tool names
     */
    getToolNames(): string[];
    /**
     * List all tools with metadata
     */
    listTools(): Array<{
        name: string;
        description: string;
        category?: string;
        tags?: string[];
        deprecated?: boolean;
    }>;
    /**
     * Search tools by criteria
     */
    search(options: ToolSearchOptions): MCPTool[];
    /**
     * Get tools by category
     */
    getByCategory(category: string): MCPTool[];
    /**
     * Get tools by tag
     */
    getByTag(tag: string): MCPTool[];
    /**
     * Get all categories
     */
    getCategories(): string[];
    /**
     * Get all tags
     */
    getTags(): string[];
    /**
     * Execute a tool
     */
    execute(name: string, input: Record<string, unknown>, context?: ToolContext): Promise<ToolCallResult>;
    /**
     * Set default execution context
     */
    setDefaultContext(context: ToolContext): void;
    /**
     * Get tool metadata
     */
    getMetadata(name: string): ToolMetadata | undefined;
    /**
     * Get registry statistics
     */
    getStats(): {
        totalTools: number;
        totalCategories: number;
        totalTags: number;
        totalRegistrations: number;
        totalLookups: number;
        totalExecutions: number;
        topTools: Array<{
            name: string;
            calls: number;
        }>;
    };
    /**
     * Validate a tool definition
     */
    validateTool(tool: MCPTool): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Validate JSON Schema
     */
    private validateSchema;
    /**
     * Update average execution time
     */
    private updateAverageExecutionTime;
    /**
     * Clear all tools
     */
    clear(): void;
}
/**
 * Create a tool registry
 */
export declare function createToolRegistry(logger: ILogger): ToolRegistry;
/**
 * Helper to create a tool definition
 */
export declare function defineTool<TInput = Record<string, unknown>, TOutput = unknown>(name: string, description: string, inputSchema: JSONSchema, handler: ToolHandler<TInput, TOutput>, options?: {
    category?: string;
    tags?: string[];
    version?: string;
    deprecated?: boolean;
    cacheable?: boolean;
    cacheTTL?: number;
    timeout?: number;
}): MCPTool<TInput, TOutput>;
export {};
//# sourceMappingURL=tool-registry.d.ts.map