import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { zipSync, strToU8, strFromU8, unzipSync, Zip, ZipDeflate } from 'fflate';
import { imageDimensions, preflightWorkbook } from '../src/limits.ts';
import { createExtractor } from '../src/extract.ts';
import type { ExtractionRuntime } from '../src/extract.ts';
import { workbook } from './fixtures.ts';
import { AnalysisSession } from '../src/session.ts';
import { createNodeExtractor } from '../src/node.ts';

test('rejects conflicting local ZIP headers instead of accepting a different worksheet amount', async () => {
  const header = ['date', 'vendor', 'category', 'amount', 'currency', 'kind'];
  const entries = unzipSync(workbook([{ name: 'Costs', rows: [header, ['2026-01-01', 'Vendor', 'tools', 1, 'USD', 'expense']] }]));
  entries['xl/worksheets/sheet2.xml'] = strToU8(strFromU8(entries['xl/worksheets/sheet1.xml']!).replace('<v>1</v>', '<v>999</v>'));
  const archive = zipSync(entries);
  const view = new DataView(archive.buffer);
  for (let i = 0; i + 30 < archive.length; i++) {
    if (view.getUint32(i, true) !== 0x04034b50) continue;
    const name = strFromU8(archive.subarray(i + 30, i + 30 + view.getUint16(i + 26, true)));
    if (name === 'xl/worksheets/sheet2.xml') archive.set(strToU8('xl/worksheets/sheet1.xml'), i + 30);
  }
  const session = new AnalysisSession({ extractor: createNodeExtractor() });
  const draft = await session.prepare([{ name: 'conflicting.xlsx', bytes: archive }], { fileOptions: { 'conflicting.xlsx': { sheet: 'Costs' } } });
  assert.equal(draft.records.length, 0, 'Conflicting ZIP headers must not substitute the 999 amount for 1');
  assert.match(draft.documents[0]?.issues[0] ?? '', /archive|header|local|duplicate/i);
  assert.throws(() => session.complete(draft.id, {}), /correct|exclude|valid/i);
  session.clear();
});

test('accepts ordinary streamed workbook entries with ZIP data descriptors', () => {
  const source = workbook([{ name: 'Costs', rows: [['date', 'amount'], ['2026-01-01', 1]] }]);
  const chunks: Uint8Array[] = [];
  const archive = new Zip((error, data) => { if (error) throw error; chunks.push(data); });
  for (const [name, data] of Object.entries(unzipSync(source))) { const file = new ZipDeflate(name); archive.add(file); file.push(data, true); }
  archive.end();
  const streamed = new Uint8Array(chunks.reduce((sum, part) => sum + part.length, 0));
  let offset = 0; for (const part of chunks) { streamed.set(part, offset); offset += part.length; }
  assert.doesNotThrow(() => preflightWorkbook(streamed));
});

test('rejects unsafe or duplicate workbook entries and embedded active objects before extraction', () => {
  for (const name of ['../escape.xml', '/xl/workbook.xml', 'xl/./workbook.xml', 'xl\\workbook.xml', '__proto__', 'xl/vbaProject.bin', 'xl/activeX/activeX1.bin', 'xl/embeddings/oleObject1.bin']) {
    const archive = zipSync({ [name === '__proto__' ? 'safe_name' : name]: strToU8('untrusted') });
    if (name === '__proto__') for (let i = 0; i + 9 <= archive.length; i++) {
      if (strToU8('safe_name').every((byte, j) => archive[i + j] === byte)) archive.set(strToU8('__proto__'), i);
    }
    assert.throws(() => preflightWorkbook(archive), /unsafe|duplicate|macro|active|embedded/i, name);
  }
  const duplicate = zipSync({ a: strToU8('first'), b: strToU8('second') });
  for (let i = 0; i + 46 < duplicate.length; i++) {
    if (new DataView(duplicate.buffer).getUint32(i, true) === 0x02014b50 && duplicate[i + 46] === 98) duplicate[i + 46] = 97;
  }
  assert.throws(() => preflightWorkbook(duplicate), /duplicate/i);
  assert.doesNotThrow(() => preflightWorkbook(workbook([{ name: 'Costs', rows: [['date', 'amount'], ['2026-01-01', 1]] }])));
});

test('validates image signatures, declared type and JPEG segment boundaries before decoding', async () => {
  const canvas = createCanvas(20, 10);
  const png = new Uint8Array(canvas.toBuffer('image/png'));
  const jpg = new Uint8Array(await canvas.encode('jpeg'));
  assert.deepEqual(imageDimensions(png), { width: 20, height: 10 });
  assert.deepEqual(imageDimensions(jpg), { width: 20, height: 10 });
  const forgedPng = png.slice(); forgedPng[4] = 0;
  assert.throws(() => imageDimensions(forgedPng), /signature|corrupt|unsupported/i);
  const shortSegment = new Uint8Array([255, 216, 255, 192, 0, 2, 8, 0, 10, 0, 20, 1, 1, 17, 0, 255, 217]);
  assert.throws(() => imageDimensions(shortSegment), /segment|corrupt|malformed/i);
  let runtimeCalls = 0;
  const extractor = createExtractor({ recognizer() { runtimeCalls++; throw new Error('OCR must not start'); } } as unknown as ExtractionRuntime);
  await assert.rejects(() => extractor({ name: 'renamed.png', bytes: jpg }, { signal: new AbortController().signal, fileOptions: {}, onProgress() {}, consumeOcrPage() {} }), /signature|type|match/i);
  assert.equal(runtimeCalls, 0);
});

test('bounds worksheet width and fields before constructing review records', async () => {
  const bytes = workbook([{ name: 'Costs', rows: [['date', 'amount'], ['2026-01-01', 1]] }]);
  for (const data of [[Array.from({ length: 257 }, (_, i) => `column${i}`)], [['date', 'notes'], ['2026-01-01', 'x'.repeat(65_537)]]]) {
    const extractor = createExtractor({ workbook: async () => [{ sheet: 'Costs', data }] } as unknown as ExtractionRuntime);
    await assert.rejects(() => extractor({ name: 'ledger.xlsx', bytes }, { signal: new AbortController().signal, fileOptions: {}, onProgress() {}, consumeOcrPage() {} }), /256|65,536|column|field/i);
  }
});
