import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = fileURLToPath(new URL('../dist/src/cli.js', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'costsieve-engine-test-'));
after(() => { for (const name of readdirSync(directory)) unlinkSync(join(directory, name)); rmdirSync(directory); });
const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });

test('runs the synthetic demo through the real engine and exports usable local reports', () => {
  const json = join(directory, 'demo.json'), csv = join(directory, 'demo.csv');
  const result = run('--demo', '--json', json, '--csv', csv);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SYNTHETIC DEMO/);
  assert.match(result.stdout, /USD/);
  const report = JSON.parse(readFileSync(json, 'utf8'));
  assert.equal(report.dataOrigin, 'SYNTHETIC_DEMO');
  const usd = report.currencies.find((row: { currency: string }) => row.currency === 'USD');
  assert.equal(usd.grossExpense, '1480');
  assert.equal(usd.netExpense, '1460');
  assert.equal(usd.netRevenue, '10200');
  assert.equal(usd.recordedSurplus, '8740');
  assert.equal(report.subscriptions.byCurrency[0].estimatedUnusedSeatCost, '60');
  assert.match(readFileSync(csv, 'utf8'), /recordedSurplus,8740/);
});

test('rejects malformed inputs and unknown arguments without creating successful-looking reports', () => {
  const malformed = join(directory, 'bad.csv');
  writeFileSync(malformed, 'date,vendor\n2026-02-30,A');
  for (const args of [[], ['--unexpected'], ['--demo', '--ledger', malformed], ['--ledger', malformed], ['--ledger', join(directory, 'missing.csv')]]) {
    const result = run(...args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CostSieve:/);
  }
});

test('requires explicit partial-import consent and refuses to overwrite files', () => {
  const ledger = join(directory, 'partial.csv');
  writeFileSync(ledger, 'date,vendor,category,amount,currency,kind\n2026-09-01,A,x,20,USD,expense\n2026-02-30,A,x,5,USD,expense');
  assert.notEqual(run('--ledger', ledger).status, 0);
  assert.equal(run('--ledger', ledger, '--allow-partial').status, 0);
  const output = join(directory, 'existing.json'); writeFileSync(output, 'keep');
  assert.notEqual(run('--demo', '--json', output).status, 0);
  assert.equal(readFileSync(output, 'utf8'), 'keep');
});

test('loads explicit scenario assumptions and includes effects in the report export', () => {
  const scenario = join(directory, 'scenario.json'), output = join(directory, 'scenario-report.json');
  writeFileSync(scenario, JSON.stringify({ currency: 'USD', changes: [{ id: 'workspace', vendor: 'Workspace', reductionPercent: '20' }], implementationCost: '10' }));
  const result = run('--demo', '--scenario', scenario, '--json', output);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(report.scenario.hypotheticalSavings, '60');
  assert.equal(report.scenario.netBenefit, '50');
  assert.match(result.stdout, /HYPOTHETICAL/);
});
