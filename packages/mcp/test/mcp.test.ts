import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, unlink, rmdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveApprovedFile } from '../src/files.ts';
import { createCostSieveServer } from '../src/server.ts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

const root = await mkdtemp(join(tmpdir(), 'costsieve-mcp-test-'));
const allowed = join(root, 'allowed'), outside = join(root, 'outside');
await mkdir(allowed); await mkdir(outside);
const csv = 'date,vendor,category,amount,currency,kind\n2026-09-01,Tools,software,100,USD,expense';
await writeFile(join(allowed, 'ledger.csv'), csv); await writeFile(join(outside, 'private.csv'), csv);
after(async () => { for (const folder of [allowed, outside]) { for (const name of await readdir(folder)) { const path = join(folder, name); if (name === 'escape' && process.platform === 'win32') await rmdir(path); else await unlink(path); } await rmdir(folder); } await rmdir(root); });

test('allows selected local files and rejects traversal, outside roots and symlink escapes', async () => {
  assert.match(await resolveApprovedFile(join(allowed, 'ledger.csv'), [allowed]), /ledger\.csv$/);
  await assert.rejects(() => resolveApprovedFile(join(allowed, '..', 'outside', 'private.csv'), [allowed]), /approved|outside/i);
  await assert.rejects(() => resolveApprovedFile(join(outside, 'private.csv'), [allowed]), /approved|outside/i);
  await symlink(outside, join(allowed, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => resolveApprovedFile(join(allowed, 'escape', 'private.csv'), [allowed]), /approved|outside/i);
  await assert.rejects(() => resolveApprovedFile(join(allowed, 'ledger.csv'), []), /root/i);
});

test('exposes seven real MCP tools and produces the same financial result as the engine', async () => {
  const server = createCostSieveServer({ allowedRoots: [allowed] });
  const client = new Client({ name: 'costsieve-test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try {
    const tools = await client.listTools(); assert.equal(tools.tools.length, 7);
    const prepared = await client.callTool({ name: 'prepare_analysis', arguments: { paths: [join(allowed, 'ledger.csv')] } });
    const draft = prepared.structuredContent as { id: string; records: unknown[] };
    assert.ok(draft.id); assert.equal(draft.records.length, 1);
    const completed = await client.callTool({ name: 'complete_analysis', arguments: { draftId: draft.id, decision: {} } });
    const report = completed.structuredContent as { analysis: { report: { currencies: { grossExpense: string }[] }; recommendations: { id: string }[] } };
    assert.equal(report.analysis.report.currencies[0]?.grossExpense, '100');
    const guide = await client.callTool({ name: 'get_action_guide', arguments: { draftId: draft.id, recommendationId: report.analysis.recommendations[0]!.id } });
    assert.equal(guide.isError, undefined);
    const exported = await client.callTool({ name: 'get_report', arguments: { draftId: draft.id, format: 'json' } });
    assert.ok(exported.content.length > 0);
    const cleared = await client.callTool({ name: 'clear_analysis', arguments: { draftId: draft.id } }); assert.equal(cleared.isError, undefined);
    const stale = await client.callTool({ name: 'get_report', arguments: { draftId: draft.id, format: 'json' } }); assert.equal(stale.isError, true);
  } finally { await client.close(); await server.close(); }
});

test('works through an actual stdio client process without stdout contamination or arbitrary filesystem access', async () => {
  const cli = fileURLToPath(new URL('../dist/src/cli.js', import.meta.url));
  const transport = new StdioClientTransport({ command: process.execPath, args: [cli, '--allow-root', allowed], stderr: 'pipe' });
  const client = new Client({ name: 'costsieve-stdio-smoke', version: '1.0.0' });
  const protocolErrors: unknown[] = []; client.onerror = error => protocolErrors.push(error);
  await client.connect(transport);
  try {
    assert.equal((await client.listTools()).tools.length, 7);
    const blocked = await client.callTool({ name: 'prepare_analysis', arguments: { paths: [join(outside, 'private.csv')] } });
    assert.equal(blocked.isError, true);
    const prepared = await client.callTool({ name: 'prepare_analysis', arguments: { paths: [join(allowed, 'ledger.csv')] } });
    const id = (prepared.structuredContent as { id: string }).id;
    const completed = await client.callTool({ name: 'complete_analysis', arguments: { draftId: id, decision: {} } });
    const analysis = (completed.structuredContent as { analysis: { report: { currencies: { grossExpense: string }[] }; recommendations: { id: string }[] } }).analysis;
    assert.equal(analysis.report.currencies[0]?.grossExpense, '100');
    const simulated = await client.callTool({ name: 'simulate_changes', arguments: { draftId: id, currency: 'USD', selections: [{ recommendationId: analysis.recommendations[0]!.id, reductionPercent: '25' }], implementationCost: '5' } });
    assert.equal((simulated.structuredContent as { netBenefit: string }).netBenefit, '20');
    const connectedCsv = 'date,vendor,category,amount,currency,kind\n' + '2026-09-01,Tools,software,1,USD,expense\n'.repeat(30_000);
    assert.ok(Buffer.byteLength(connectedCsv) > 1024 * 1024);
    const connected = await client.callTool({ name: 'prepare_connected_analysis', arguments: { csv: connectedCsv, sourceLabel: 'Approved connected ledger' } }, undefined, { timeout: 30_000 });
    assert.equal(connected.isError, undefined);
    assert.equal((connected.structuredContent as { recordCount: number }).recordCount, 30_000);
    assert.deepEqual(protocolErrors, []);
  } finally { await client.close(); }
});

test('connected ledger data uses the same review pipeline without files or new connector credentials', async () => {
  const server = createCostSieveServer({ allowedRoots: [allowed] }), client = new Client({ name: 'connected-test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const prepared = await client.callTool({ name: 'prepare_connected_analysis', arguments: { csv, sourceLabel: 'Approved accounting export, September' } });
    assert.equal(prepared.isError, undefined);
    const draft = prepared.structuredContent as { id: string; sourceLabel: string; records: unknown[] };
    assert.match(draft.sourceLabel, /Approved accounting/); assert.equal(draft.records.length, 1);
    const result = await client.callTool({ name: 'complete_analysis', arguments: { draftId: draft.id, decision: {} } });
    assert.equal((result.structuredContent as any).analysis.report.currencies[0].grossExpense, '100');
    const invalid = await client.callTool({ name: 'prepare_connected_analysis', arguments: { csv: 'broken', sourceLabel: 'Bad export' } });
    const invalidDraft = invalid.structuredContent as { documents: { issues: string[] }[] };
    assert.ok(invalid.isError || invalidDraft.documents.some(doc => doc.issues.length));
    const large = await client.callTool({ name: 'prepare_connected_analysis', arguments: { csv: '€'.repeat(800_000), sourceLabel: 'Oversized' } });
    assert.equal(large.isError, true);
    assert.deepEqual((await readdir(allowed)).filter(name => name !== 'escape').sort(), ['ledger.csv']);
  } finally { await client.close(); await server.close(); }
});

test('returns usable bounded summaries and questions for a large permitted ledger', async () => {
  const path = join(allowed, 'large.csv');
  await writeFile(path, 'date,vendor,category,amount,currency,kind\n' + '2026-09-01,Acme,software,1,USD,expense\n'.repeat(20_000));
  const server = createCostSieveServer({ allowedRoots: [allowed] }), client = new Client({ name: 'large-ledger-test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const prepared = await client.callTool({ name: 'prepare_analysis', arguments: { paths: [path] } });
    const id = (prepared.structuredContent as { id: string }).id;
    const completed = await client.callTool({ name: 'complete_analysis', arguments: { draftId: id, decision: {} } });
    assert.notEqual(completed.isError, true);
    const result = completed.structuredContent as { analysis: { report: { currencies: { grossExpense: string }[] }; questions: { targetRecordIds: string[] }[] } };
    assert.equal(result.analysis.report.currencies[0]?.grossExpense, '20000');
    assert.ok(result.analysis.questions.every(question => question.targetRecordIds.length <= 100));
  } finally { await client.close(); await server.close(); }
});
