import { extractInvoiceFields } from './invoice.ts';
import { imageDimensions, preflightWorkbook, cancellable } from './limits.ts';
import type { DocumentExtractor, ExtractionOptions } from './types.ts';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api.js';

export interface ExtractionRuntime {
  workbook: (bytes: Uint8Array) => Promise<{ sheet: string; data: unknown[][] }[]>;
  pdf: (bytes: Uint8Array, signal: AbortSignal) => Promise<PDFDocumentProxy>;
  raster: (page: PDFPageProxy, options: ExtractionOptions) => Promise<Uint8Array | HTMLCanvasElement>;
  recognizer: (options: ExtractionOptions) => { recognize(image: Uint8Array | HTMLCanvasElement): Promise<string>; close(): Promise<void> };
}

export function createExtractor(runtime: ExtractionRuntime): DocumentExtractor {
  return async (file, options) => {
    options.signal.throwIfAborted();
    if (file.name.toLowerCase().endsWith('.xlsx')) {
      preflightWorkbook(file.bytes);
      const sheets = await cancellable(runtime.workbook(file.bytes), options.signal, () => {});
      if (!sheets.length) throw new Error('Workbook has no readable worksheets.');
      if (sheets.length > 1 && !options.fileOptions.sheet) throw new Error(`Choose one worksheet explicitly: ${sheets.map(sheet => sheet.sheet).join(', ')}.`);
      const sheet = options.fileOptions.sheet ? sheets.find(sheet => sheet.sheet === options.fileOptions.sheet) : sheets[0];
      if (!sheet) throw new Error('The selected worksheet does not exist.');
      if (sheet.data.length > 100_001) throw new Error('Worksheet exceeds the 100,000-record limit.');
      if (sheet.data.some(row => row.length > 256)) throw new Error('Worksheet exceeds the 256-column limit. Export only relevant columns.');
      if (sheet.data.some(row => row.some(value => typeof value === 'string' && value.length > 65_536))) throw new Error('Worksheet field exceeds the 65,536-character limit.');
      const header = sheet.data[0];
      if (!header) throw new Error('Selected worksheet is empty.');
      const records: unknown[][] = [], recordNumbers: number[] = [];
      for (let index = 1; index < sheet.data.length; index++) {
        const row = sheet.data[index]!;
        if (row.every(value => value === null || value === undefined || value === '')) continue;
        records.push(Array.from({ length: header.length }, (_, column) => row[column] ?? '')); recordNumbers.push(index + 1);
      }
      return { kind: 'table', headers: header.map(value => value === null || value === undefined ? '' : String(value)), records, recordNumbers, sheet: sheet.sheet };
    }
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) imageDimensions(file.bytes, file.name.split('.').at(-1)?.toLowerCase());
    const recognizer = runtime.recognizer(options);
    try {
      if (!isPdf) {
        options.consumeOcrPage();
        const raw = await recognizer.recognize(file.bytes);
        return { kind: 'invoice', fields: extractInvoiceFields(raw), pages: 1, method: 'ocr' };
      }
      const pdf = await runtime.pdf(file.bytes, options.signal);
      try {
        if (pdf.numPages > 20) throw new Error('PDF exceeds the 20-page limit. Split the document and retry.');
        let raw = '', ocr = false;
        for (let number = 1; number <= pdf.numPages; number++) {
          options.signal.throwIfAborted();
          const page = await pdf.getPage(number);
          try {
            const content = await cancellable(page.getTextContent(), options.signal, () => { void pdf.loadingTask.destroy(); });
            let text = '', lastY: number | undefined;
            for (const item of content.items) {
              if (!('str' in item)) continue;
              const y = item.transform[5] as number;
              if (lastY !== undefined && Math.abs(y - lastY) > 3) text += '\n';
              text += item.str + (item.hasEOL ? '\n' : ' '); lastY = y;
            }
            if (text.replace(/\s/g, '').length < 30) {
              options.consumeOcrPage(); ocr = true;
              const image = await runtime.raster(page, options);
              text = await recognizer.recognize(image);
            }
            raw += `${text}\n`;
            options.onProgress({ stage: 'pdf', progress: number / pdf.numPages });
          } finally { page.cleanup(); }
        }
        return { kind: 'invoice', fields: extractInvoiceFields(raw), pages: pdf.numPages, method: ocr ? 'ocr' : 'pdf-text' };
      } finally { await pdf.loadingTask.destroy(); }
    } finally { await recognizer.close(); }
  };
}
