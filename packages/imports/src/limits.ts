import { unzipSync, Unzip } from 'fflate';

export function preflightWorkbook(bytes: Uint8Array) {
  let size = 0, entries = 0;
  const names = new Set<string>();
  const central = new Map<string, { compression: number; size: number; originalSize: number }>();
  unzipSync(bytes, { filter(file) {
    size += file.originalSize; entries++;
    if (size > 100 * 1024 * 1024 || entries > 10_000) throw new Error('Workbook exceeds the 100 MiB expanded-data or 10,000-entry limit.');
    if (/[\\:\0]/.test(file.name) || file.name.startsWith('/') || /(?:^|\/)\.{1,2}(?:\/|$)/.test(file.name) || ['__proto__', 'constructor', 'prototype'].includes(file.name)) throw new Error('Workbook contains an unsafe archive entry name. Re-export values as .xlsx or CSV.');
    const name = file.name.toLowerCase().replace(/\/$/, '');
    if (names.has(name)) throw new Error('Workbook contains duplicate archive entry names. Re-export it as .xlsx or CSV.');
    names.add(name);
    if (/(?:^|\/)(?:vbaProject\.bin$|activeX(?:\/|$)|embeddings(?:\/|$))/i.test(file.name)) throw new Error('Macro-enabled workbooks and embedded active objects are not supported; export values as .xlsx or CSV.');
    central.set(file.name, { compression: file.compression, size: file.size, originalSize: file.originalSize });
    return false;
  } });
  // Node and browser readers consult different ZIP header tables.
  const local = new Set<string>();
  const archive = new Unzip(file => {
    const expected = central.get(file.name);
    if (!expected || local.has(file.name) || file.compression !== expected.compression || (file.size !== undefined && file.size !== expected.size) || (file.originalSize !== undefined && file.originalSize !== expected.originalSize)) throw new Error('Workbook ZIP local headers and directory metadata mismatch. Re-export values as .xlsx or CSV.');
    local.add(file.name);
  });
  archive.push(bytes, true);
  if (local.size !== central.size) throw new Error('Workbook ZIP local headers and directory metadata mismatch. Re-export values as .xlsx or CSV.');
}

export function imageDimensions(bytes: Uint8Array, expectedType?: string) {
  let width = 0, height = 0;
  let type: 'png' | 'jpeg' | undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) && view.getUint32(8) === 13 && view.getUint32(12) === 0x49484452) {
    type = 'png';
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    type = 'jpeg';
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 255) throw new Error('Malformed JPEG header.');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++]!;
      if ([216, 217, 1, ...Array.from({ length: 8 }, (_, i) => 208 + i)].includes(marker)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw new Error('Malformed JPEG segment.');
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (length < 11 || !bytes[offset + 7] || length < 8 + 3 * bytes[offset + 7]!) throw new Error('Malformed JPEG frame segment.');
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
      }
      offset += length;
    }
  }
  if (!width || !height) throw new Error('Unsupported or corrupted image; use a valid JPG or PNG.');
  if (expectedType && (expectedType === 'jpg' ? 'jpeg' : expectedType) !== type) throw new Error('Image signature does not match its filename type. Re-export it as JPG or PNG.');
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
