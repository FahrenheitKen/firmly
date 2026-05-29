/**
 * Secure Random Utilities
 *
 * Cryptographically secure random ID and token generation.
 * Replaces Math.random() for security-sensitive operations.
 *
 * @module v3/shared/security/secure-random
 */
/**
 * Generate a cryptographically secure random ID
 * @param prefix Optional prefix for the ID
 * @param length Number of random bytes (default 12)
 * @returns Secure random ID string
 */
export declare function generateSecureId(prefix?: string, length?: number): string;
/**
 * Generate a UUID v4 (cryptographically secure)
 * @returns UUID string
 */
export declare function generateUUID(): string;
/**
 * Generate a secure token for authentication
 * @param length Number of bytes (default 32)
 * @returns Hex-encoded token string
 */
export declare function generateSecureToken(length?: number): string;
/**
 * Generate a short secure ID (for display purposes)
 * @param prefix Optional prefix
 * @returns Short secure ID
 */
export declare function generateShortId(prefix?: string): string;
/**
 * Generate a secure session ID
 * @returns Session ID string
 */
export declare function generateSessionId(): string;
/**
 * Generate a secure agent ID
 * @returns Agent ID string
 */
export declare function generateAgentId(): string;
/**
 * Generate a secure task ID
 * @returns Task ID string
 */
export declare function generateTaskId(): string;
/**
 * Generate a secure memory ID
 * @returns Memory ID string
 */
export declare function generateMemoryId(): string;
/**
 * Generate a secure event ID
 * @returns Event ID string
 */
export declare function generateEventId(): string;
/**
 * Generate a secure swarm ID
 * @returns Swarm ID string
 */
export declare function generateSwarmId(): string;
/**
 * Generate a secure pattern ID
 * @returns Pattern ID string
 */
export declare function generatePatternId(): string;
/**
 * Generate a secure trajectory ID
 * @returns Trajectory ID string
 */
export declare function generateTrajectoryId(): string;
/**
 * Generate a random integer in range [min, max] using crypto
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @returns Cryptographically random integer
 */
export declare function secureRandomInt(min: number, max: number): number;
/**
 * Secure random selection from array
 * @param array Array to select from
 * @returns Random element
 */
export declare function secureRandomChoice<T>(array: T[]): T;
/**
 * Secure shuffle array (Fisher-Yates with crypto)
 * @param array Array to shuffle
 * @returns New shuffled array
 */
export declare function secureShuffleArray<T>(array: T[]): T[];
//# sourceMappingURL=secure-random.d.ts.map