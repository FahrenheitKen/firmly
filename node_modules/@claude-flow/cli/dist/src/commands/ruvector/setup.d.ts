/**
 * V3 CLI RuVector Setup Command
 * Outputs Docker files and SQL for easy RuVector PostgreSQL setup
 *
 * Usage:
 *   npx claude-flow ruvector setup              # Output to ./ruvector-postgres/
 *   npx claude-flow ruvector setup --output /path/to/dir
 *   npx claude-flow ruvector setup --print      # Print to stdout only
 *
 * Created with care by ruv.io
 */
import type { Command } from '../../types.js';
/**
 * RuVector Setup command - outputs Docker files and SQL
 */
export declare const setupCommand: Command;
export default setupCommand;
//# sourceMappingURL=setup.d.ts.map