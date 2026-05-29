/**
 * PostgreSQL security utilities for RuVector commands.
 * Prevents SQL injection via identifier interpolation.
 *
 * @module v3/cli/commands/ruvector/pg-utils
 */
/**
 * Validate a PostgreSQL schema name.
 * Throws if the name contains characters that could enable SQL injection.
 * Safe names are returned as-is (no quoting needed since they match the identifier pattern).
 */
export declare function validateSchemaName(schema: string): string;
export declare function validateTimestamp(value: string): string;
//# sourceMappingURL=pg-utils.d.ts.map