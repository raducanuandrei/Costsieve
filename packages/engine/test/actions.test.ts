import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLedgerRows, analyzeRecords, simulateActions, getActionGuide } from '../src/actions.ts';
import { exportAnalysisCsv } from '../src/export.ts';

const rows = () => validateLedgerRows([
  { recordId: 'a:2', source: { documentId: 'a', kind: 'csv', record: 2 }, date: '2026-09-01', vendor: 'Tools', category: 'software', amount: '100', currency: 'USD', kind: 'expense' },
  { recordId: 'b:2', source: { documentId: 'b', kind: 'xlsx', record: 2, sheet: 'Costs' }, date: '2026-09-01', vendor: 'Tools', category: 'software', amount: '200', currency: 'USD', kind: 'expense' },
  { recordId: 'a:3', source: { documentId: 'a', kind: 'csv', record: 3 }, date: '2026-09-02', vendor: 'Sales', category: 'sales', amount: '1000', currency: 'USD', kind: 'revenue' },
]);

test('validates normalized records with globally unique identities and original source references', () => {
  const input = rows();
  assert.equal(input.rows.length, 3);
  assert.deepEqual(input.rows.map(row => row.sourceRow), [2, 2, 3]);
  const report = analyzeRecords(input);
  assert.equal(report.report.currencies[0]?.netExpense, '300');
  assert.equal(new Set(report.recommendations.map(item => item.id)).size, report.recommendations.length);
  assert.ok(report.recommendations.every(item => item.targetRecordIds.every(id => ['a:2', 'b:2'].includes(id))));
});

test('rejects duplicate record IDs, invalid magnitudes and missing sources at the trust boundary', () => {
  const first = rows().rows[0]!;
  assert.throws(() => validateLedgerRows([first, first]), /recordId/i);
  assert.throws(() => validateLedgerRows([{ ...first, amount: '-2' }]), /nonnegative|decimal/i);
  assert.throws(() => validateLedgerRows([{ ...first, source: undefined }]), /source/i);
});

test('targets one service rather than all spending with a vendor and reports same-period impact', () => {
  const result = simulateActions(rows(), [{ id: 'reduce', targetRecordIds: ['a:2'], reductionPercent: '50' }], { currency: 'USD', implementationCost: '10' });
  assert.equal(result.baselineExpense, '300');
  assert.equal(result.projectedExpense, '250');
  assert.equal(result.hypotheticalSavings, '50');
  assert.equal(result.netBenefit, '40');
  assert.equal(result.recordedResultBefore, '700');
  assert.equal(result.recordedResultAfter, '740');
  assert.equal(result.classification, 'HYPOTHETICAL');
});

test('rejects overlapping alternatives, unknown records, revenue targets and currency mixing', () => {
  for (const changes of [
    [{ id: 'a', targetRecordIds: ['a:2'], reductionPercent: '20' }, { id: 'b', targetRecordIds: ['a:2'], reductionPercent: '30' }],
    [{ id: 'a', targetRecordIds: ['unknown'], reductionPercent: '20' }],
    [{ id: 'a', targetRecordIds: ['a:3'], reductionPercent: '20' }],
  ]) assert.throws(() => simulateActions(rows(), changes, { currency: 'USD' }));
  assert.throws(() => simulateActions(rows(), [{ id: 'a', targetRecordIds: ['a:2'], reductionPercent: '20' }], { currency: 'EUR' }));
});

test('asks at most three targeted questions and leaves opportunity amounts unknown without evidence', () => {
  const result = analyzeRecords(rows());
  assert.ok(result.questions.length <= 3);
  assert.ok(result.recommendations.every(item => item.estimatedSavings === null));
  const refined = analyzeRecords(rows(), { usage: [{ targetRecordIds: ['a:2'], paidSeats: 10, activeSeats: 4, uniformPricing: true, reductionAllowed: true }] });
  assert.equal(refined.recommendations.find(item => item.kind === 'unused_seats')?.estimatedSavings, '60');
  const guide = getActionGuide('unused_seats');
  assert.ok(guide.steps.length >= 3);
  assert.ok(guide.verification.length > 0);
  assert.ok(guide.rollback.length > 0);
});

test('qualifies exported finding evidence across files and rejects overlapping usage answers', () => {
  const result = analyzeRecords(rows());
  assert.ok(result.report.findings.every(item => item.evidence?.every(source => ['a', 'b'].includes(source.documentId))));
  const answer = { targetRecordIds: ['a:2'], paidSeats: 10, activeSeats: 4, uniformPricing: true, reductionAllowed: true };
  assert.throws(() => analyzeRecords(rows(), { usage: [answer, answer] }), /overlap|duplicate/i);
});

test('scenario dates include all records contributing to the displayed recorded result', () => {
  const input = rows(); input.rows[2]!.date = '2025-01-01';
  const result = simulateActions(input, [{ id: 'reduce', targetRecordIds: ['a:2'], reductionPercent: '50' }], { currency: 'USD' });
  assert.equal(result.period.from, '2025-01-01');
  assert.equal(result.period.to, '2026-09-01');
});

test('CSV analysis export retains explicit opportunity assumptions and qualified evidence', () => {
  const result = analyzeRecords(rows(), { usage: [{ targetRecordIds: ['a:2'], paidSeats: 10, activeSeats: 4, uniformPricing: true, reductionAllowed: true }] });
  const csv = exportAnalysisCsv(result);
  assert.match(csv, /estimatedSavings,60,ESTIMATED/);
  assert.ok(csv.includes('a:2'));
  assert.match(csv, /period/);
});
