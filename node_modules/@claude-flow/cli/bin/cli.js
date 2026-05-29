#!/usr/bin/env node
/**
 * @claude-flow/cli - CLI Entry Point
 *
 * Claude Flow V3 Command Line Interface
 *
 * Auto-detects MCP mode when stdin is piped and no args provided.
 * This allows: echo '{"jsonrpc":"2.0",...}' | npx @claude-flow/cli
 */

import { randomUUID } from 'crypto';

// Suppress the SPECIFIC cosmetic "[AgentDB Patch] Controller index not found"
// warning from agentic-flow's runtime patch — these are emitted because the
// patch was written for agentdb v1.x and we use v3, where the controllers
// dist directory is laid out differently. The warning surfaces on every
// command and the audit (audit_1776483149979) flagged a too-broad suppression
// as a security risk because it could hide legitimate [AgentDB Patch] warnings.
//
// Tight match: must include both the prefix AND the specific "Controller
// index not found" text. Anything else (including future [AgentDB Patch]
// warnings about real issues) flows through unchanged. Also patch
// console.log because the underlying code uses it (the previous filter
// only caught console.warn and was therefore a no-op).
const _origWarn = console.warn;
const _origLog = console.log;
const _isCosmeticAgentdbPatchNoise = (msg) =>
  msg.includes('[AgentDB Patch]') && msg.includes('Controller index not found');
console.warn = (...args) => {
  if (_isCosmeticAgentdbPatchNoise(String(args[0] ?? ''))) return;
  _origWarn.apply(console, args);
};
console.log = (...args) => {
  if (_isCosmeticAgentdbPatchNoise(String(args[0] ?? ''))) return;
  _origLog.apply(console, args);
};

// Check if we should run in MCP server mode
// Conditions:
//   1. stdin is being piped AND no CLI arguments provided (auto-detect)
//   2. stdin is being piped AND args are "mcp start" (explicit, e.g. npx claude-flow@alpha mcp start)
//   3. EXCEPT — if the user explicitly passed --transport <non-stdio>
//      (e.g. -t http), defer to the parser. Without this, every smoke
//      test or non-TTY caller of `mcp start -t http` got force-routed
//      into stdio mode and never hit the HTTP server (#1874 follow-up).
const cliArgs = process.argv.slice(2);
const isExplicitMCP = cliArgs.length >= 1 && cliArgs[0] === 'mcp' && (cliArgs.length === 1 || cliArgs[1] === 'start');
const explicitNonStdioTransport = cliArgs.some((a, i) => {
  // -t <value> | --transport <value>
  if ((a === '-t' || a === '--transport') && cliArgs[i + 1] && cliArgs[i + 1] !== 'stdio') return true;
  // --transport=<value>
  if (/^--transport=/.test(a) && !/^--transport=stdio$/.test(a)) return true;
  return false;
});
const isMCPMode = !process.stdin.isTTY
  && !explicitNonStdioTransport
  && (process.argv.length === 2 || isExplicitMCP);

if (isMCPMode) {
  // Run MCP server mode
  const { listMCPTools, callMCPTool, hasTool } = await import('../dist/src/mcp-client.js');

  const VERSION = '3.0.0';
  const sessionId = `mcp-${Date.now()}-${randomUUID().slice(0, 8)}`;

  console.error(
    `[${new Date().toISOString()}] INFO [claude-flow-mcp] (${sessionId}) Starting in stdio mode`
  );

  // Audit-flagged DoS protection (audit_1776483149979): cap the
  // newline-buffered stdin parser so a malicious client cannot pipe
  // gigabytes of un-newlined data and exhaust memory before
  // JSON.parse runs. 10MB is far above any legitimate MCP message
  // (the protocol's largest realistic payloads — tool descriptions,
  // batch search results — top out at ~1MB).
  const MCP_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    if (buffer.length > MCP_MAX_BUFFER_BYTES) {
      // Drop the buffer + emit a protocol-level error so the client
      // sees the rejection rather than a silent OOM.
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Buffered stdin exceeds ${MCP_MAX_BUFFER_BYTES} bytes without newline; resetting`,
        },
      }));
      buffer = '';
      return;
    }
    let lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' },
          }));
          continue;
        }
        try {
          const response = await handleMessage(message);
          if (response) {
            console.log(JSON.stringify(response));
          }
        } catch (error) {
          // #1606: Return proper internal error instead of parse error
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id ?? null,
            error: { code: -32603, message: error instanceof Error ? error.message : 'Internal error' },
          }));
        }
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });

  async function handleMessage(message) {
    if (!message.method) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32600, message: 'Invalid Request: missing method' },
      };
    }

    const params = message.params || {};

    switch (message.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'ruflo', version: VERSION },
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: true, listChanged: true },
            },
          },
        };

      case 'tools/list': {
        const tools = listMCPTools();
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            })),
          },
        };
      }

      case 'tools/call': {
        const toolName = params.name;
        const toolParams = params.arguments || {};

        if (!hasTool(toolName)) {
          return {
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32601, message: `Tool not found: ${toolName}` },
          };
        }

        try {
          const result = await callMCPTool(toolName, toolParams, { sessionId });
          return {
            jsonrpc: '2.0',
            id: message.id,
            result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
          };
        } catch (error) {
          return {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Tool execution failed',
            },
          };
        }
      }

      case 'notifications/initialized':
        return null;

      case 'ping':
        return { jsonrpc: '2.0', id: message.id, result: {} };

      default:
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: `Method not found: ${message.method}` },
        };
    }
  }
} else {
  // Run normal CLI mode
  const { CLI } = await import('../dist/src/index.js');
  const cli = new CLI();
  cli.run()
    .then(() => {
      // #1552: Exit cleanly after one-shot commands.
      // Long-running commands (daemon foreground, mcp, status --watch) never resolve,
      // so this only fires for normal CLI commands.
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error.message);
      process.exit(1);
    });
}
