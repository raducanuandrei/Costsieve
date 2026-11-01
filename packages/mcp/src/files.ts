import { realpath, stat, open } from 'node:fs/promises';
import { relative, resolve, isAbsolute, sep, basename } from 'node:path';
import type { InputDocument } from '@costsieve/imports/node';

function contained(root: string, file: string) { const path = relative(root, file); return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path); }

export async function resolveApprovedFile(path: string, roots: string[]): Promise<string> {
  if (!roots.length) throw new Error('Configure at least one approved root before reading files.');
  const file = await realpath(resolve(path));
  const approved = await Promise.all(roots.map(root => realpath(resolve(root))));
  if (!approved.some(root => contained(root, file))) throw new Error('File is outside the approved roots. No data was read.');
  if (!(await stat(file)).isFile()) throw new Error('Choose a regular local file.');
  return file;
}

export async function readApprovedDocuments(paths: string[], roots: string[]): Promise<InputDocument[]> {
  if (paths.length < 1 || paths.length > 20) throw new Error('Choose between 1 and 20 files.');
  const files: InputDocument[] = [];
  let total = 0;
  const seen = new Set<string>(), names = new Set<string>();
  for (const path of paths) {
    const resolved = await resolveApprovedFile(path, roots);
    if (seen.has(resolved)) throw new Error('The same file was selected twice.');
    const name = basename(resolved);
    if (names.has(name)) throw new Error('Selected files must have distinct names so mapping choices remain unambiguous. Rename a local copy.');
    seen.add(resolved); names.add(name);
    const handle = await open(resolved, 'r');
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.size > 20 * 1024 * 1024) throw new Error('Each document must be a regular file no larger than 20 MiB.');
      if (total + before.size > 50 * 1024 * 1024) throw new Error('Combined input exceeds 50 MiB.');
      const buffer = new Uint8Array(before.size + 1);
      let length = 0;
      while (length < buffer.length) { const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length); if (!bytesRead) break; length += bytesRead; }
      const after = await handle.stat();
      const current = await resolveApprovedFile(resolved, roots), currentStat = await stat(current);
      if (length !== before.size || after.size !== before.size || currentStat.ino !== after.ino || currentStat.dev !== after.dev) throw new Error('Input changed while it was being read. Retry with a stable local copy.');
      total += length; files.push({ name, bytes: buffer.slice(0, length) });
    } finally { await handle.close(); }
  }
  return files;
}
