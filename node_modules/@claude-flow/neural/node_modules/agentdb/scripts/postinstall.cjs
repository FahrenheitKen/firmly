#!/usr/bin/env node
/**
 * AgentDB Post-Install Script
 * Verifies sql.js (WASM SQLite) is available — no native compilation needed.
 */

function main() {
  // Skip in CI environments or if explicitly disabled
  if (process.env.CI || process.env.AGENTDB_SKIP_POSTINSTALL === 'true') {
    return;
  }

  // Verify core dependency: sql.js
  try {
    require('sql.js');
    console.log('[agentdb] sql.js (WASM SQLite): OK');
  } catch {
    console.error('[agentdb] sql.js not found — run: npm install sql.js');
  }

  // Check optional deps without failing
  try {
    require('better-sqlite3');
    console.log('[agentdb] better-sqlite3: available (optional)');
  } catch {
    console.log('[agentdb] better-sqlite3: not installed (optional, sql.js used)');
  }
}

main();
