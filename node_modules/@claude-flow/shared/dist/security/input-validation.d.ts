/**
 * Input Validation Utilities
 *
 * Secure input validation and sanitization.
 *
 * @module v3/shared/security/input-validation
 */
/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
    sanitized?: unknown;
}
/**
 * Validation options
 */
export interface ValidationOptions {
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
    allowedChars?: RegExp;
    required?: boolean;
    trim?: boolean;
}
/**
 * Validate and sanitize string input
 * @param input Input string
 * @param options Validation options
 * @returns Validation result
 */
export declare function validateInput(input: unknown, options?: ValidationOptions): ValidationResult;
/**
 * Sanitize string by removing dangerous characters
 * @param input Input string
 * @returns Sanitized string
 */
export declare function sanitizeString(input: string): string;
/**
 * Validate file path (prevent path traversal)
 * @param path File path
 * @param allowedBase Allowed base directory
 * @returns Validation result
 */
export declare function validatePath(path: string, allowedBase?: string): ValidationResult;
/**
 * Validate command (prevent command injection)
 * @param command Command string
 * @param allowedCommands Optional whitelist of allowed commands
 * @returns Validation result
 */
export declare function validateCommand(command: string, allowedCommands?: string[]): ValidationResult;
/**
 * Validate tags for safe SQL usage
 * @param tags Array of tag strings
 * @returns Validation result with sanitized tags
 */
export declare function validateTags(tags: unknown): ValidationResult;
/**
 * Check if string is a valid identifier
 * @param id Identifier string
 * @returns True if valid
 */
export declare function isValidIdentifier(id: string): boolean;
/**
 * Escape string for safe SQL usage (use parameterized queries instead when possible)
 * This is a LAST RESORT - always prefer parameterized queries
 * @param value String to escape
 * @returns Escaped string
 */
export declare function escapeForSql(value: string): string;
//# sourceMappingURL=input-validation.d.ts.map