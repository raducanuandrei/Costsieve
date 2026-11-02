import readWorkbook from 'read-excel-file/browser';
import { createExtractor } from './extract.ts';
import { localRecognizer } from './ocr.ts';
import { cancellable } from './limits.ts';

export function createBrowserExtractor(assetsBase = '/costsieve-assets/') {
  const base = new URL(assetsBase.endsWith('/') ? assetsBase : `${assetsBase}/`, location.href);
  if (base.origin !== location.origin) throw new Error('Document workers and language assets must be self-hosted on the same origin.');
  return createExtractor({
    workbook: bytes => readWorkbook(new Blob([bytes.slice().buffer]), { parseNumber: value => value }),
    async pdf(bytes, signal) {
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
      GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', base).href;
      const task = getDocument({ data: bytes.slice(), useWorkerFetch: false, disableAutoFetch: true, disableStream: true, verbosity: 0 });
      try { return await cancellable(task.promise, signal, () => { void task.destroy(); }); }
      catch (error) { if (error instanceof Error && error.name === 'PasswordException') throw new Error('Password-protected PDFs are not supported. Export an unlocked copy.'); throw error; }
    },
    async raster(page, options) {
      const initial = page.getViewport({ scale: 2 });
      const scale = initial.width * initial.height > 8_000_000 ? 2 * Math.sqrt(8_000_000 / (initial.width * initial.height)) : 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas rendering is unavailable.');
      const render = page.render({ canvas, canvasContext: context, viewport });
      await cancellable(render.promise, options.signal, () => render.cancel());
      return canvas;
    },
    recognizer: options => localRecognizer(options, async () => ({ languages: ['eng', 'ron'], settings: { workerPath: new URL('worker.min.js', base).href, corePath: new URL('core/', base).href, langPath: new URL('languages/', base).href, workerBlobURL: false } })),
  });
}
