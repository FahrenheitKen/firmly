/**
 * V3 Hooks System - Example Usage
 *
 * Demonstrates practical use cases for the hooks system.
 *
 * @module v3/shared/hooks/example-usage
 */
export declare function setupSecurityHooks(): {
    registry: import("./registry.js").HookRegistry;
    executor: import("./executor.js").HookExecutor;
};
export declare function setupLearningHooks(): {
    registry: import("./registry.js").HookRegistry;
    executor: import("./executor.js").HookExecutor;
};
export declare function setupPerformanceHooks(): {
    registry: import("./registry.js").HookRegistry;
    executor: import("./executor.js").HookExecutor;
    performanceMetrics: Map<string, {
        start: number;
        end?: number;
    }>;
};
export declare function setupFileValidationHooks(): {
    registry: import("./registry.js").HookRegistry;
    executor: import("./executor.js").HookExecutor;
};
export declare function setupSessionHooks(): {
    registry: import("./registry.js").HookRegistry;
    executor: import("./executor.js").HookExecutor;
};
export declare function setupErrorHooks(): {
    registry: import("./registry.js").HookRegistry;
    executor: import("./executor.js").HookExecutor;
    errorLog: {
        timestamp: Date;
        error: Error;
        context?: string;
    }[];
};
export declare function runDemo(): Promise<void>;
//# sourceMappingURL=example-usage.d.ts.map