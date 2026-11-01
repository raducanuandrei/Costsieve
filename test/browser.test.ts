import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { createCanvas } from '@napi-rs/canvas';
import { workbook, invoicePdf } from '../packages/imports/test/fixtures.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const mime = (path: string) => path.endsWith('.wasm') ? 'application/wasm' : /\.(?:js|mjs)$/.test(path) ? 'text/javascript' : 'application/octet-stream';

test('runs local document review, OCR, correction, scenarios and reset in a real browser without sending document data', { timeout: 120_000 }, async () => {
  const requests: { url: string; method: string; body: string | null }[] = [];
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') { res.writeHead(405).end(); return; }
      const pathname = new URL(req.url!, 'http://localhost').pathname;
      if (pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><html lang="en"><meta charset="utf-8"><title>CostSieve browser verification</title><label for="files">Choose documents</label><input id="files" type="file" multiple><button id="review">Review documents</button><output id="status" aria-live="polite"></output><script type="module">import * as api from "/bundle/index.js"; window.costsieve = api;</script></html>'); return; }
      const directory = pathname.startsWith('/costsieve-assets/') ? resolve(root, 'packages/imports/assets') : pathname.startsWith('/bundle/') ? resolve(root, 'packages/imports/dist/browser') : null;
      if (!directory) { res.writeHead(404).end(); return; }
      const target = resolve(directory, decodeURIComponent(pathname.replace(/^\/(?:costsieve-assets|bundle)\//, '')));
      const rel = relative(directory, target);
      if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) { res.writeHead(403).end(); return; }
      res.writeHead(200, { 'Content-Type': mime(target) }).end(await readFile(target));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ ...(process.env.CI ? {} : { channel: 'chrome' }), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => { const req = route.request(); requests.push({ url: req.url(), method: req.method(), body: req.postData() }); if (!req.url().startsWith(`http://127.0.0.1:${port}/`)) await route.abort(); else await route.continue(); });
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => Boolean((window as any).costsieve));
    await page.keyboard.press('Tab'); assert.equal(await page.locator('#files').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab'); assert.equal(await page.locator('#review').evaluate(el => el === document.activeElement), true);
    const file = { name: 'costs.xlsx', bytes: Array.from(workbook([{ name: 'Costs', rows: [['date', 'vendor', 'category', 'amount', 'currency', 'kind'], ['2026-09-01', 'PRIVATE_VENDOR_MARKER', 'software', 100, 'USD', 'expense']] }])) };
    const result = await page.evaluate(async file => {
      const { AnalysisSession, createBrowserExtractor } = (window as any).costsieve;
      const session = new AnalysisSession({ extractor: createBrowserExtractor() });
      const draft = await session.prepare([{ name: file.name, bytes: new Uint8Array(file.bytes) }]);
      const result = session.complete(draft.id, {});
      const row = draft.records[0];
      const scenario = session.simulate(draft.id, [{ id: 'reduce', targetRecordIds: [row.recordId], reductionPercent: '20' }], { currency: 'USD' });
      const csv = session.report(draft.id, 'csv'); session.clear();
      let cleared = false; try { session.result(draft.id); } catch { cleared = true; }
      return { cost: result.analysis.report.currencies[0]?.grossExpense, saving: scenario.hypotheticalSavings, csv, cleared };
    }, file);
    assert.equal(result.cost, '100'); assert.equal(result.saving, '20'); assert.ok(result.csv.includes('PRIVATE_VENDOR_MARKER')); assert.equal(result.cleared, true);
    const pdf = await page.evaluate(async bytes => {
      const { AnalysisSession, createBrowserExtractor } = (window as any).costsieve;
      const session = new AnalysisSession({ extractor: createBrowserExtractor() });
      const draft = await session.prepare([{ name: 'invoice.pdf', bytes: new Uint8Array(bytes) }]);
      session.clear(); return draft;
    }, Array.from(await invoicePdf()));
    assert.deepEqual(pdf.documents[0]?.issues, []); assert.equal(pdf.records[0]?.fields.amount, '120');
    const canvas = createCanvas(1400, 1000), context = canvas.getContext('2d'); context.fillStyle = 'white'; context.fillRect(0, 0, 1400, 1000); context.fillStyle = 'black'; context.font = '44px Arial';
    ['Acme Tools', 'Invoice 001', 'Date: 2026-09-01', 'Grand total: 120.00 USD'].forEach((text, index) => context.fillText(text, 70, 120 + index * 140));
    const scan = await page.evaluate(async bytes => {
      const { AnalysisSession, createBrowserExtractor } = (window as any).costsieve;
      const session = new AnalysisSession({ extractor: createBrowserExtractor() });
      const draft = await session.prepare([{ name: 'scan.png', bytes: new Uint8Array(bytes) }]);
      const result = draft.records.length ? session.complete(draft.id, { confirmedRecordIds: [draft.records[0].recordId] }) : null;
      session.clear(); return { draft, result };
    }, Array.from(canvas.toBuffer('image/png')));
    assert.deepEqual(scan.draft.documents[0]?.issues, []); assert.equal(scan.result?.analysis.report.currencies[0]?.grossExpense, '120');
    assert.deepEqual(errors, []);
    assert.ok(requests.every(req => req.method === 'GET' && req.body === null && !req.url.includes('PRIVATE_VENDOR_MARKER')));
    assert.ok(requests.some(req => req.url.includes('traineddata')));
  } finally { await browser.close(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
