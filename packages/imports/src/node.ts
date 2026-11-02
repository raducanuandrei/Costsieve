import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import readWorkbook from 'read-excel-file/node';
import { createCanvas } from '@napi-rs/canvas';
import { createExtractor } from './extract.ts';
import { localRecognizer } from './ocr.ts';
import { cancellable } from './limits.ts';

const require = createRequire(import.meta.url);

export function createNodeExtractor() {
  return createExtractor({
    workbook: bytes => readWorkbook(Buffer.from(bytes), { parseNumber: value => value }),
    async pdf(bytes, signal) {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = getDocument({ data: bytes.slice(), useWorkerFetch: false, disableAutoFetch: true, disableStream: true, verbosity: 0 });
      try { return await cancellable(task.promise, signal, () => { void task.destroy(); }); }
      catch (error) { if (error instanceof Error && error.name === 'PasswordException') throw new Error('Password-protected PDFs are not supported. Export an unlocked copy.'); throw error; }
    },
    async raster(page, options) {
      const base = page.getViewport({ scale: 2 });
      const scale = base.width * base.height > 8_000_000 ? 2 * Math.sqrt(8_000_000 / (base.width * base.height)) : 2;
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.max(1, Math.floor(viewport.width)), Math.max(1, Math.floor(viewport.height)));
      const render = page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D, viewport });
      await cancellable(render.promise, options.signal, () => render.cancel());
      return new Uint8Array(await canvas.encode('png'));
    },
    recognizer: options => localRecognizer(options, async () => ({
      languages: ['eng', 'ron'],
      settings: { workerPath: require.resolve('tesseract.js/src/worker-script/node/index.js'), langPath: join(dirname(require.resolve('@costsieve/imports/package.json')), 'assets', 'languages') },
    })),
  });
}

export { AnalysisSession } from './session.ts';
export type * from './types.ts';
