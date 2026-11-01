#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCostSieveServer } from './server.ts';

try {
  const { values } = parseArgs({ options: { 'allow-root': { type: 'string', multiple: true }, help: { type: 'boolean' } }, strict: true });
  if (values.help) {
    process.stderr.write('CostSieve local MCP\nUsage: costsieve-mcp --allow-root <directory> [--allow-root <directory>]\nNo document upload, API key or paid AI service. Returned summaries may be sent to the host AI provider.\n');
  } else {
    if (!values['allow-root']?.length) throw new Error('At least one explicit --allow-root is required.');
    const roots = await Promise.all(values['allow-root'].map(async path => { const root = await realpath(resolve(path)); if (!(await stat(root)).isDirectory()) throw new Error('Approved roots must be existing directories.'); return root; }));
    const server = createCostSieveServer({ allowedRoots: roots });
    await server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 1024 * 1024 }));
    const finish = async () => { await server.close(); process.exitCode = 0; };
    process.once('SIGINT', finish); process.once('SIGTERM', finish); process.stdin.once('end', finish);
  }
} catch (error) { process.stderr.write(`CostSieve: ${error instanceof Error ? error.message : 'MCP startup failed.'}\n`); process.exitCode = 1; }
