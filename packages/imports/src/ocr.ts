import { createWorker } from 'tesseract.js';
import type { Lang, Worker, WorkerOptions } from 'tesseract.js';
import { cancellable } from './limits.ts';
import type { ExtractionOptions } from './types.ts';

export function localRecognizer(options: ExtractionOptions, configure: () => Promise<{ languages: string[] | Lang[]; settings: Partial<WorkerOptions> }>) {
  let worker: Worker | undefined, closed = false;
  const close = async () => { closed = true; if (worker) { const active = worker; worker = undefined; await active.terminate(); } };
  return {
    async recognize(image: Uint8Array | HTMLCanvasElement) {
      const work = (async () => {
        if (!worker) {
          const { languages, settings } = await configure();
          if (closed || options.signal.aborted) throw new Error('OCR cancelled.');
          const created = await createWorker(languages, 1, { ...settings, cacheMethod: 'none', logger: event => options.onProgress({ stage: 'ocr', progress: event.progress }), errorHandler: () => {} });
          if (closed || options.signal.aborted) { await created.terminate(); throw new Error('OCR cancelled.'); }
          worker = created;
        }
        const result = await worker.recognize(image as Parameters<Worker['recognize']>[0]);
        return result.data.text;
      })();
      return cancellable(work, options.signal, () => { void close(); });
    }, close,
  };
}
