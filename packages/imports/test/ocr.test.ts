import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { AnalysisSession } from '../src/session.ts';
import { createNodeExtractor } from '../src/node.ts';

function invoiceImage() {
  const canvas = createCanvas(1400, 1100), context = canvas.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, 1400, 1100);
  context.fillStyle = 'black'; context.font = '44px Arial';
  ['Acme Tools', 'Invoice 001', 'Date: 2026-09-01', 'Subtotal: 100.00 USD', 'VAT: 20.00 USD', 'Grand total: 120.00 USD'].forEach((line, index) => context.fillText(line, 90, 120 + index * 110));
  return new Uint8Array(canvas.toBuffer('image/png'));
}

test('recognizes a real invoice image locally with bundled language data', { timeout: 120_000 }, async () => {
  const session = new AnalysisSession({ extractor: createNodeExtractor() });
  const draft = await session.prepare([{ name: 'scan.png', bytes: invoiceImage() }]);
  assert.deepEqual(draft.documents[0]?.issues, []);
  assert.equal(draft.records[0]?.fields.amount, '120');
  assert.equal(draft.records[0]?.fields.currency, 'USD');
  assert.equal(draft.records[0]?.requiresConfirmation, true);
  session.clear();
});

test('renders scanned PDF pages before OCR and keeps subtotal separate from invoice total', { timeout: 120_000 }, async () => {
  const pdf = await PDFDocument.create(), page = pdf.addPage([700, 550]);
  page.drawImage(await pdf.embedPng(invoiceImage()), { x: 0, y: 0, width: 700, height: 550 });
  const session = new AnalysisSession({ extractor: createNodeExtractor() });
  const draft = await session.prepare([{ name: 'scan.pdf', bytes: await pdf.save() }]);
  assert.deepEqual(draft.documents[0]?.issues, []);
  assert.equal(draft.records[0]?.fields.amount, '120');
  session.clear();
});

test('cancels actual OCR without retaining a draft or crashing on late progress', { timeout: 30_000 }, async () => {
  const controller = new AbortController();
  const session = new AnalysisSession({ extractor: createNodeExtractor() });
  const pending = session.prepare([{ name: 'cancel.png', bytes: invoiceImage() }], { signal: controller.signal, onProgress: () => controller.abort() });
  await assert.rejects(() => pending, /cancel|abort/i);
  assert.throws(() => session.review('unknown'), /active/i);
});
