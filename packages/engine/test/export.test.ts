import { test } from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import { importLedgerCsv } from '../src/import.ts';
import { analyzeBusiness } from '../src/analyze.ts';
import { exportSummaryCsv, exportReportJson } from '../src/export.ts';
import { simulateScenario } from '../src/scenario.ts';

test('neutralizes formula-like labels including leading controls and whitespace', () => {
  const input = importLedgerCsv('date,vendor,category,amount,currency,kind,transaction_id,description\n2026-09-01,"=HYPERLINK(""https://example.test"")","@evil",12,USD,expense,secret-id,secret-description\n2026-09-02,"\t+SUM(1)","-formula",5,USD,expense,secret-id-2,secret-description-2');
  const report = analyzeBusiness(input);
  const csv = exportSummaryCsv(report);
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true }).data;
  const formulaLabels = parsed.filter(row => ['vendor', 'category'].includes(row.dimension ?? '')).map(row => row.label ?? '');
  assert.ok(formulaLabels.includes(`'=HYPERLINK("https://example.test")`));
  assert.ok(formulaLabels.includes("'@evil"));
  assert.ok(formulaLabels.includes("'+SUM(1)"));
  assert.equal(csv.includes('secret-id'), false);
  assert.equal(csv.includes('secret-description'), false);
  assert.ok(parsed.some(row => row.metric === 'grossExpense' && row.value === '17'));
});

test('exports summary provenance and assumptions without raw sensitive fields', () => {
  const report = analyzeBusiness(importLedgerCsv('date,vendor,category,amount,currency,kind,transaction_id,description\n2026-09-01,A,x,10,USD,expense,private-id,private-description'), { generatedAt: '2026-11-01T00:00:00Z' });
  const json = exportReportJson(report);
  const output = JSON.parse(json);
  assert.equal(output.schemaVersion, 'costsieve-business-v1');
  assert.equal(output.coverage.validRows, 1);
  assert.equal(output.generatedAt, '2026-11-01T00:00:00.000Z');
  assert.ok(output.limitations.length > 0);
  assert.equal(json.includes('private-id'), false);
  assert.equal(json.includes('private-description'), false);
  assert.equal(output.rows, undefined);
});

test('exports optional scenario assumptions and net effects alongside the observed baseline', () => {
  const input = importLedgerCsv('date,vendor,category,amount,currency,kind\n2026-09-01,A,x,100,USD,expense');
  const report = analyzeBusiness(input);
  const scenario = simulateScenario(input, { currency: 'USD', changes: [{ id: '=unsafe', vendor: 'A', reductionPercent: '20' }], implementationCost: '5' });
  assert.equal(JSON.parse(exportReportJson(report, scenario)).scenario.netBenefit, '15');
  const rows = Papa.parse<Record<string, string>>(exportSummaryCsv(report, scenario), { header: true }).data;
  assert.ok(rows.some(row => row.dimension === 'scenario' && row.metric === 'netBenefit' && row.value === '15'));
  assert.ok(rows.some(row => row.dimension === 'scenario_change' && row.label === "'=unsafe" && row.classification === 'HYPOTHETICAL'));
});
