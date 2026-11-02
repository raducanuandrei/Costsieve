import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisSession } from '../src/session.ts';
import { extractInvoiceFields } from '../src/invoice.ts';

const csv = (name: string, body: string) => ({ name, bytes: new TextEncoder().encode(body) });
const header = 'date,vendor,category,amount,currency,kind';
const bank = () => csv('ledger.csv', `${header}\n2026-09-01,Acme,software,120,USD,expense\n2026-09-02,Sales,sales,500,USD,revenue`);
const invoiceExtractor = async () => ({ kind: 'invoice' as const, fields: { date: '2026-09-01', vendor: 'Acme', category: 'software', amount: '120', currency: 'USD', kind: 'expense' }, pages: 1, method: 'pdf-text' as const });

test('prepares local CSV review and returns stable source-qualified identities without raw descriptions', async () => {
  const session = new AnalysisSession();
  const draft = await session.prepare([bank()]);
  assert.equal(draft.records.length, 2);
  assert.equal(new Set(draft.records.map(row => row.recordId)).size, 2);
  const result = session.complete(draft.id, {});
  assert.equal(result.analysis.report.currencies[0]?.netExpense, '120');
  assert.equal(result.analysis.report.currencies[0]?.recordedSurplus, '380');
  assert.equal(result.coverage.confirmedRecords, 2);
});

test('requires confirmation for every invoice and detects an invoice/payment reconciliation candidate', async () => {
  const session = new AnalysisSession({ extractor: invoiceExtractor });
  const draft = await session.prepare([bank(), { name: 'invoice.pdf', bytes: new TextEncoder().encode('%PDF-test') }]);
  const invoice = draft.records.find(row => row.source.kind === 'pdf')!;
  assert.equal(invoice.requiresConfirmation, true);
  assert.equal(draft.reconciliations.length, 1);
  assert.throws(() => session.complete(draft.id, {}), /confirm|reconcil/i);
  const payment = draft.records.find(row => row.source.kind === 'csv' && row.fields.kind === 'expense')!;
  const result = session.complete(draft.id, { confirmedRecordIds: [invoice.recordId], reconciliations: [{ keepRecordId: payment.recordId, excludeRecordIds: [invoice.recordId] }] });
  assert.equal(result.analysis.report.currencies[0]?.netExpense, '120');
  assert.equal(result.coverage.reconciledRecords, 1);
  assert.equal(result.analysis.recommendations.some(row => row.estimatedSavings === '120'), false);
});

test('allows explicit separate purchases and blocks invalid fields until corrected or excluded', async () => {
  const session = new AnalysisSession();
  const draft = await session.prepare([csv('data.csv', `${header}\n2026-02-30,Acme,x,bad,USD,expense\n2026-09-01,Other,x,50,USD,expense`)]);
  assert.throws(() => session.complete(draft.id, {}), /invalid|correct|confirm/i);
  const result = session.complete(draft.id, { corrections: [{ recordId: draft.records[0]!.recordId, fields: { date: '2026-09-01', amount: '20' } }] });
  assert.equal(result.analysis.report.currencies[0]?.netExpense, '70');
});

test('keeps Excel/raw OCR text out of the returned review and returns only extracted invoice fields', () => {
  const fields = extractInvoiceFields('Acme Tools\nInvoice 001\nDate: 2026-09-01\nSubtotal: 100.00 USD\nVAT: 20.00 USD\nGrand total: 120.00 USD\nSECRET ACCOUNT 999');
  assert.equal(fields.amount, '120');
  assert.equal(fields.currency, 'USD');
  assert.equal(fields.date, '2026-09-01');
  assert.equal(JSON.stringify(fields).includes('SECRET'), false);
});

test('clears memory, expires inactive drafts and does not silently use an old analysis', async () => {
  let now = 0;
  const session = new AnalysisSession({ now: () => now });
  const draft = await session.prepare([bank()]);
  now = 30 * 60 * 1000 + 1;
  assert.throws(() => session.complete(draft.id, {}), /expired|active/i);
  const fresh = await session.prepare([bank()]);
  session.clear(fresh.id);
  assert.throws(() => session.complete(fresh.id, {}), /active|cleared/i);
});

test('bounds file batches and handles cancellation before touching any document', async () => {
  const session = new AnalysisSession();
  await assert.rejects(() => session.prepare(Array.from({ length: 21 }, () => bank())), /20 files/i);
  await assert.rejects(() => session.prepare([{ name: 'large.csv', bytes: new Uint8Array(20 * 1024 * 1024 + 1) }]), /20 MiB/i);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(() => session.prepare([bank()], { signal: abort.signal }), /abort|cancel/i);
});

test('a stale token cannot clear a newer analysis and explicit exclusions stay visible in the base report', async () => {
  const session = new AnalysisSession();
  const draft = await session.prepare([csv('partial.csv', `${header}\n2026-09-01,A,x,10,USD,expense\n2026-02-30,B,x,20,USD,expense`)]);
  assert.throws(() => session.review('stale-token'), /active/i);
  assert.equal(session.review(draft.id).id, draft.id);
  const result = session.complete(draft.id, { excludedRecordIds: [draft.records[1]!.recordId] });
  assert.equal(result.status, 'partial');
  assert.equal(result.analysis.report.status, 'partial');
  assert.equal(result.analysis.report.coverage.excludedRows, 1);
});

test('rejects contradictory source reconciliation and unknown decision fields', async () => {
  const session = new AnalysisSession({ extractor: invoiceExtractor });
  const draft = await session.prepare([bank(), { name: 'invoice.pdf', bytes: new TextEncoder().encode('%PDF-test') }]);
  const invoice = draft.records.find(row => row.source.kind === 'pdf')!, payment = draft.records.find(row => row.fields.kind === 'expense' && row.source.kind === 'csv')!;
  assert.throws(() => session.complete(draft.id, { confirmedRecordIds: [invoice.recordId], excludedRecordIds: [payment.recordId], reconciliations: [{ keepRecordId: payment.recordId, excludeRecordIds: [invoice.recordId] }] }), /keep|reconcil/i);
  assert.throws(() => session.complete(draft.id, { unsafe: true } as never), /decision|unsupported/i);
});

test('rechecks source reconciliation after correcting OCR fields and exposes the new review group', async () => {
  const session = new AnalysisSession({ extractor: async () => ({ kind: 'invoice', fields: { date: '2026-09-01', vendor: 'Acme', amount: 'I20', currency: 'USD', kind: 'expense' }, pages: 1, method: 'ocr' }) });
  const draft = await session.prepare([bank(), { name: 'scan.pdf', bytes: new TextEncoder().encode('%PDF') }]);
  const invoice = draft.records.find(row => row.source.kind === 'pdf')!;
  assert.equal(draft.reconciliations.length, 0);
  assert.throws(() => session.complete(draft.id, { confirmedRecordIds: [invoice.recordId], corrections: [{ recordId: invoice.recordId, fields: { amount: '120' } }] }), /reconcil/i);
  assert.equal(session.review(draft.id).reconciliations.length, 1);
});

test('detects distinct hash/colon invoice references from the same supplier', () => {
  for (const label of ['Invoice #', 'Invoice: ', 'Factura nr. ']) {
    assert.throws(() => extractInvoiceFields(`Supplier: Acme\n${label}001\nDate: 2026-09-01\nGrand total: 120.00 USD\nSupplier: Acme\n${label}002\nDate: 2026-10-01\nGrand total: 120.00 USD`), /multiple|split/i);
  }
});

test('exports the active scenario and labels synthetic data without changing financial calculations', async () => {
  const session = new AnalysisSession({ dataOrigin: 'SYNTHETIC_DEMO' });
  const draft = await session.prepare([bank()]); const result = session.complete(draft.id, {});
  assert.equal(result.analysis.report.dataOrigin, 'SYNTHETIC_DEMO');
  session.simulate(draft.id, [{ id: 'reduce', targetRecordIds: [draft.records[0]!.recordId], reductionPercent: '20' }], { currency: 'USD', implementationCost: '5' });
  assert.equal(JSON.parse(session.report(draft.id, 'json')).scenario.netBenefit, '19');
  assert.match(session.report(draft.id, 'csv'), /netBenefit,19,HYPOTHETICAL/);
});

test('a rejected usage update cannot export a previous hidden scenario', async () => {
  const session = new AnalysisSession(); const draft = await session.prepare([bank()]);
  session.complete(draft.id, { corrections: [{ recordId: draft.records[0]!.recordId, fields: { amount: '10' } }] });
  const targetRecordIds = [draft.records[0]!.recordId];
  session.simulate(draft.id, [{ id: 'reduce', targetRecordIds, reductionPercent: '20' }], { currency: 'USD' });
  assert.throws(() => session.complete(draft.id, { usage: [{ targetRecordIds, paidSeats: 1, activeSeats: 2, uniformPricing: true, reductionAllowed: true }] }), /seat/i);
  assert.equal(JSON.parse(session.report(draft.id, 'json')).scenario, undefined);
});

test('review activity renews inactivity expiry without cloning the whole draft', async () => {
  let now = 0; const session = new AnalysisSession({ now: () => now, ttlMs: 1000 });
  const draft = await session.prepare([bank()]); now = 900;
  session.keepAlive(draft.id); now = 1500;
  assert.equal(session.review(draft.id).id, draft.id);
  now = 2600; assert.throws(() => session.keepAlive(draft.id), /expired|active/i);
});
