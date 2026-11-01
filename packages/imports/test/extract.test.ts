import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNodeExtractor } from '../src/node.ts';
import { AnalysisSession } from '../src/session.ts';
import { imageDimensions } from '../src/limits.ts';
import { workbook, invoicePdf } from './fixtures.ts';
import { PDFDocument, StandardFonts } from 'pdf-lib';

test('reads real XLSX cells as decimal strings and requires a sheet choice when ambiguous', async () => {
  const extractor = createNodeExtractor();
  const rows = [['date', 'vendor', 'category', 'amount', 'currency', 'kind'], ['2026-09-01', 'Acme', 'tools', 0.1, 'USD', 'expense']];
  const session = new AnalysisSession({ extractor });
  const draft = await session.prepare([{ name: 'ledger.xlsx', bytes: workbook([{ name: 'Costs', rows }]) }]);
  assert.deepEqual(draft.documents[0]?.issues, []);
  assert.equal(draft.records[0]?.fields.amount, '0.1');
  assert.equal(session.complete(draft.id, {}).analysis.report.currencies[0]?.netExpense, '0.1');
  const ambiguous = await session.prepare([{ name: 'multiple.xlsx', bytes: workbook([{ name: 'A', rows }, { name: 'B', rows }]) }]);
  assert.match(ambiguous.documents[0]?.issues[0] ?? '', /sheet|worksheet/i);
});

test('extracts text PDF invoice totals without counting subtotal and tax twice', async () => {
  const session = new AnalysisSession({ extractor: createNodeExtractor() });
  const draft = await session.prepare([{ name: 'invoice.pdf', bytes: await invoicePdf() }]);
  assert.deepEqual(draft.documents[0]?.issues, []);
  assert.equal(draft.records[0]?.fields.amount, '120');
  assert.equal(draft.records[0]?.requiresConfirmation, true);
  const result = session.complete(draft.id, { confirmedRecordIds: [draft.records[0]!.recordId] });
  assert.equal(result.analysis.report.currencies[0]?.netExpense, '120');
});

test('rejects legacy formats, malformed documents and page limits without a misleading report', async () => {
  const session = new AnalysisSession({ extractor: createNodeExtractor() });
  for (const file of [
    { name: 'old.xls', bytes: new Uint8Array([1]) },
    { name: 'broken.xlsx', bytes: new Uint8Array([1, 2, 3]) },
    { name: 'broken.pdf', bytes: new Uint8Array([1, 2, 3]) },
    { name: 'many.pdf', bytes: await invoicePdf(21) },
  ]) { const draft = await session.prepare([file]); assert.ok(draft.documents[0]!.issues.length > 0); assert.throws(() => session.complete(draft.id, {})); }
});

test('checks image dimensions before decoding large images', () => {
  const png = new Uint8Array(33); png.set([137, 80, 78, 71, 13, 10, 26, 10]); new DataView(png.buffer).setUint32(8, 13); png.set([73, 72, 68, 82], 12);
  new DataView(png.buffer).setUint32(16, 100_000); new DataView(png.buffer).setUint32(20, 100_000);
  assert.throws(() => imageDimensions(png), /20 megapixel/i);
});

test('refuses a PDF containing distinct invoices instead of silently counting only one', async () => {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const [vendor, number] of [['Acme', '001'], ['Other', '002']]) {
    const page = pdf.addPage([600, 800]);
    [`Supplier: ${vendor}`, `Invoice ${number}`, 'Date: 2026-09-01', 'Grand total: 120.00 USD'].forEach((line, index) => page.drawText(line, { x: 40, y: 730 - index * 40, size: 20, font }));
  }
  const session = new AnalysisSession({ extractor: createNodeExtractor() });
  const draft = await session.prepare([{ name: 'two-invoices.pdf', bytes: await pdf.save() }]);
  assert.equal(draft.records.length, 0);
  assert.match(draft.documents[0]?.issues[0] ?? '', /multiple|split|separate/i);
  assert.throws(() => session.complete(draft.id, {}));
});
