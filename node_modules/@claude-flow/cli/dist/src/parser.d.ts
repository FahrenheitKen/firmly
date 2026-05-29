/**
 * V3 CLI Command Parser
 * Advanced argument parsing with validation and type coercion
 */
import type { Command, CommandOption, ParsedFlags } from './types.js';
export interface ParseResult {
    command: string[];
    flags: ParsedFlags;
    positional: string[];
    raw: string[];
}
export interface ParserOptions {
    stopAtFirstNonFlag?: boolean;
    allowUnknownFlags?: boolean;
    booleanFlags?: string[];
    stringFlags?: string[];
    arrayFlags?: string[];
    aliases?: Record<string, string>;
    defaults?: Record<string, unknown>;
}
export declare class CommandParser {
    private options;
    private commands;
    private lazyCommandNames;
    private globalOptions;
    constructor(options?: ParserOptions);
    private initializeGlobalOptions;
    registerCommand(command: Command): void;
    /**
     * Register a lazy-loaded command's name so Pass 1/Pass 2 can recognize it as
     * a command position even though its full definition hasn't been loaded yet.
     * Fix for #1596: without this, lazy commands like `daemon start` were
     * mis-routed because Pass 1 walked past `daemon` and greedy-matched `start`.
     */
    registerLazyCommandName(name: string): void;
    /**
     * #1791.2 — true when `name` is a lazy command that hasn't been promoted
     * to a fully registered Command yet. The CLI uses this to eagerly load
     * the module before parsing so its subcommand flags (e.g. `-d` for
     * `hive-mind task --description`) are scoped into the alias map. Without
     * this, lazy commands' short flags silently fall through to global
     * resolution and the action handler sees an empty `flags.description`.
     */
    isLazyOnly(name: string): boolean;
    private isKnownCommandName;
    getCommand(name: string): Command | undefined;
    getAllCommands(): Command[];
    parse(args: string[]): ParseResult;
    private parseFlag;
    private parseValue;
    private normalizeKey;
    private buildAliases;
    /**
     * Build aliases scoped to a specific command/subcommand.
     * The resolved command's short flags take priority over global ones,
     * fixing collisions where multiple subcommands use the same short flag (e.g. -t).
     */
    private buildScopedAliases;
    /**
     * Get boolean flags scoped to a specific command/subcommand.
     */
    private getScopedBooleanFlags;
    private getBooleanFlags;
    private applyDefaults;
    validateFlags(flags: ParsedFlags, command?: Command): string[];
    getGlobalOptions(): CommandOption[];
}
export declare const commandParser: CommandParser;
//# sourceMappingURL=parser.d.ts.map