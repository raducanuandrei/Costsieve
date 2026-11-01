import { unzipSync } from 'fflate';

export function preflightWorkbook(bytes: Uint8Array) {
  let size = 0, entries = 0;
  unzipSync(bytes, { filter(file) {
    size += file.originalSize; entries++;
    if (size > 100 * 1024 * 1024 || entries > 10_000) throw new Error('Workbook exceeds the 100 MiB expanded-data or 10,000-entry limit.');
    if (/vbaProject\.bin$/i.test(file.name)) throw new Error('Macro-enabled workbooks are not supported; export values as .xlsx or CSV.');
    return false;
  } });
}

export function imageDimensions(bytes: Uint8Array) {
  let width = 0, height = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 255) throw new Error('Malformed JPEG header.');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++]!;
      if ([216, 217, 1, ...Array.from({ length: 8 }, (_, i) => 208 + i)].includes(marker)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw new Error('Malformed JPEG segment.');
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) { height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break; }
      offset += length;
    }
  }
  if (!width || !height) throw new Error('Unsupported or corrupted image; use a valid JPG or PNG.');
  if (width * height > 20_000_000) throw new Error('Image exceeds the 20 megapixel limit. Resize it before importing.');
  return { width, height };
}

export async function cancellable<T>(work: Promise<T>, signal: AbortSignal, cancel: () => void, timeoutMs = 120_000): Promise<T> {
  if (signal.aborted) { cancel(); throw new Error('Document processing cancelled.'); }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort: () => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    rejectAbort = () => { cancel(); reject(new Error('Document processing cancelled.')); };
    signal.addEventListener('abort', rejectAbort, { once: true });
    timer = setTimeout(() => { cancel(); reject(new Error('Page processing exceeded 120 seconds. Retry or enter the values manually.')); }, timeoutMs);
  });
  try { return await Promise.race([work, stopped]); }
  finally { if (timer) clearTimeout(timer); signal.removeEventListener('abort', rejectAbort); }
}
