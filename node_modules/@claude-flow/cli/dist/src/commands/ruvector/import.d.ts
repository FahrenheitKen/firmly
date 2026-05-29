/**
 * V3 CLI RuVector Import Command
 * Import data from sql.js/JSON memory to RuVector PostgreSQL
 *
 * Usage:
 *   npx claude-flow ruvector import --input memory-export.json
 *   npx claude-flow ruvector import --from-memory
 *   npx claude-flow ruvector import --input data.json --batch-size 100
 *
 * Created with care by ruv.io
 */
import type { Command } from '../../types.js';
/**
 * RuVector Import command - import from sql.js/JSON to PostgreSQL
 */
export declare const importCommand: Command;
export default importCommand;
//# sourceMappingURL=import.d.ts.map