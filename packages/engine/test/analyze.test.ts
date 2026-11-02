import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importLedgerCsv, importSubscriptionsCsv } from '../src/import.ts';
import { analyzeBusiness } from '../src/analyze.ts';

const ledger = (rows: string[]) => importLedgerCsv(['date,vendor,category,amount,currency,kind', ...rows].join('\n'));
const generatedAt = '2026-11-01T00:00:00.000Z';

test('reconciles exact decimal expenses, refunds, revenue and transfers in separate currencies', () => {
  const report = analyzeBusiness(ledger([
    '2026-09-01,A,tools,0.1,USD,expense', '2026-09-02,B,tools,0.2,USD,expense',
    '2026-09-03,A,tools,0.05,USD,expense_refund', '2026-09-04,Sales,sales,10,USD,revenue',
    '2026-09-05,Sales,sales,1,USD,revenue_refund', '2026-09-06,Bank,internal,99,USD,transfer',
    '2026-09-01,A,tools,20,EUR,expense',
  ]), { generatedAt });
  const usd = report.currencies.find(row => row.currency === 'USD')!;
  assert.equal(usd.grossExpense, '0.3');
  assert.equal(usd.netExpense, '0.25');
  assert.equal(usd.netRevenue, '9');
  assert.equal(usd.recordedSurplus, '8.75');
  assert.equal(usd.transfers, '99');
  assert.equal(report.currencies.find(row => row.currency === 'EUR')?.netExpense, '20');
  assert.equal(report.byCategory.find(row => row.currency === 'USD' && row.key === 'tools')?.netExpense, '0.25');
  assert.equal(report.generatedAt, generatedAt);
  assert.equal(report.status, 'complete');
});

test('requires explicit continuation after invalid rows and reports coverage', () => {
  const input = ledger(['2026-09-01,A,x,20,USD,expense', '2026-02-30,A,x,30,USD,expense']);
  assert.throws(() => analyzeBusiness(input), /allowPartial/);
  const report = analyzeBusiness(input, { allowPartial: true });
  assert.equal(report.coverage.excludedRows, 1);
  assert.equal(report.coverage.validRows, 1);
  assert.equal(report.status, 'partial');
  assert.ok(report.limitations.some(text => /revenue/i.test(text)));
  assert.throws(() => analyzeBusiness(importLedgerCsv('bad,header\n1,2')), /columns|headers|CSV/i);
  assert.throws(() => analyzeBusiness(ledger([])), /no valid/i);
});

test('keeps possible duplicate charges in totals and never treats candidates as savings', () => {
  const report = analyzeBusiness(ledger(['2026-09-01,Tools,x,40,USD,expense', '2026-09-01,tools,x,40,USD,expense']));
  assert.equal(report.currencies[0]?.grossExpense, '80');
  const candidate = report.findings.find(row => row.kind === 'possible_duplicate')!;
  assert.deepEqual(candidate.evidenceRows, [2, 3]);
  assert.equal(candidate.estimatedMonthlyOpportunity, null);
  assert.match(candidate.caveat, /legitimate|review/i);
});

test('flags stable single charges over three consecutive months without inferring cancellation savings', () => {
  const report = analyzeBusiness(ledger([
    '2026-07-01,Tools,software,100,USD,expense', '2026-08-01,Tools,software,100,USD,expense',
    '2026-09-01,Tools,software,100,USD,expense',
    '2026-07-01,Irregular,stock,20,USD,expense', '2026-09-01,Irregular,stock,20,USD,expense',
    '2026-10-01,Irregular,stock,20,USD,expense',
  ]));
  const recurring = report.findings.filter(row => row.kind === 'recurring_charge');
  assert.equal(recurring.length, 1);
  assert.equal(recurring[0]?.vendor, 'Tools');
  assert.equal(recurring[0]?.estimatedMonthlyOpportunity, null);
  assert.deepEqual(recurring[0]?.evidenceRows, [2, 3, 4]);
});

test('only compares consecutive complete observation months and handles missing baseline spending', () => {
  const input = ledger(['2026-08-03,A,x,100,USD,expense', '2026-09-03,A,x,150,USD,expense']);
  assert.deepEqual(analyzeBusiness(input).monthlyChanges, []);
  const report = analyzeBusiness(input, { observationStart: '2026-08-01', observationEnd: '2026-09-30' });
  assert.equal(report.monthlyChanges[0]?.changePercent, '50');
  assert.equal(report.monthlyChanges[0]?.delta, '50');
  assert.throws(() => analyzeBusiness(input, { observationStart: '2026-09-01', observationEnd: '2026-08-31' }), /observation/i);
  assert.throws(() => analyzeBusiness(input, { observationStart: '2026-08-04', observationEnd: '2026-09-30' }), /outside/i);
});

test('estimates unused seat cost from declared inventory without adding it to ledger cost', () => {
  const subscriptions = importSubscriptionsCsv('subscription_id,vendor,currency,amount_per_cycle,billing_cycle,seats,active_seats\na,Tools,USD,120,monthly,10,4\nb,Annual,USD,1200,annual,10,5\nc,Unknown,EUR,24,monthly,,');
  const report = analyzeBusiness(ledger(['2026-09-01,Tools,software,120,USD,expense']), { subscriptions });
  assert.equal(report.currencies[0]?.grossExpense, '120');
  assert.equal(report.subscriptions.byCurrency.find(row => row.currency === 'USD')?.monthlyCommitment, '220');
  assert.equal(report.subscriptions.byCurrency.find(row => row.currency === 'USD')?.estimatedUnusedSeatCost, '122');
  assert.equal(report.findings.filter(row => row.kind === 'unused_seats').length, 2);
  assert.match(report.findings.find(row => row.vendor === 'Annual')!.caveat, /annual|contract/i);
  assert.equal(report.findings.find(row => row.kind === 'unknown_seat_usage')?.estimatedMonthlyOpportunity, null);
});

test('handles prototype-like grouping labels without losing or executing data', () => {
  const report = analyzeBusiness(ledger(['2026-09-01,__proto__,constructor,10,USD,expense', '2026-09-02,toString,__proto__,20,USD,expense']));
  assert.equal(report.byVendor.find(row => row.key === '__proto__')?.grossExpense, '10');
  assert.equal(report.byCategory.find(row => row.key === '__proto__')?.grossExpense, '20');
});

test('handles the supported calendar boundaries without generating an invalid adjacent month', () => {
  const old = analyzeBusiness(ledger(['0000-01-01,A,x,10,USD,expense', '0000-02-01,A,x,20,USD,expense']), { observationStart: '0000-01-01', observationEnd: '0000-02-29' });
  assert.equal(old.monthlyChanges[0]?.delta, '10');
  const recent = analyzeBusiness(ledger(['9999-11-01,A,x,10,USD,expense', '9999-12-01,A,x,20,USD,expense']), { observationStart: '9999-11-01', observationEnd: '9999-12-31' });
  assert.equal(recent.monthlyChanges[0]?.delta, '10');
});

test('detects overlapping three-month recurrence windows after an earlier anchor drifts', () => {
  const report = analyzeBusiness(ledger(['2026-01-01,A,x,100,USD,expense', '2026-02-01,A,x,104,USD,expense', '2026-03-01,A,x,108,USD,expense', '2026-04-01,A,x,109,USD,expense']));
  const finding = report.findings.find(row => row.kind === 'recurring_charge');
  assert.deepEqual(finding?.evidenceRows, [3, 4, 5]);
});
