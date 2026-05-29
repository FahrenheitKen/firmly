/**
 * Rate limiter for update checks
 * Prevents excessive npm registry queries
 */
export interface RateLimitState {
    lastCheck: string;
    checksToday: number;
    date: string;
    packageVersions: Record<string, string>;
}
export declare function loadState(): RateLimitState;
export declare function saveState(state: RateLimitState): void;
export declare function shouldCheckForUpdates(intervalHours?: number): {
    allowed: boolean;
    reason?: string;
};
export declare function recordCheck(packageVersions: Record<string, string>): void;
export declare function getCachedVersions(): Record<string, string>;
export declare function clearCache(): void;
//# sourceMappingURL=rate-limiter.d.ts.map