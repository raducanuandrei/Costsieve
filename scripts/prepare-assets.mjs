import { createRequire } from 'node:module';
import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../packages/imports/assets/', import.meta.url));
await mkdir(join(root, 'languages'), { recursive: true });
await mkdir(join(root, 'core'), { recursive: true });
for (const language of ['eng', 'ron']) await copyFile(join(dirname(require.resolve(`@tesseract.js-data/${language}`)), '4.0.0_best_int', `${language}.traineddata.gz`), join(root, 'languages', `${language}.traineddata.gz`));
await copyFile(require.resolve('tesseract.js/dist/worker.min.js'), join(root, 'worker.min.js'));
const core = dirname(require.resolve('tesseract.js-core'));
for (const name of await readdir(core)) if (/\.(wasm|js)$/.test(name) && name.startsWith('tesseract-core')) await copyFile(join(core, name), join(root, 'core', name));
await copyFile(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), join(root, 'pdf.worker.min.mjs'));
for (const packageName of ['pdfjs-dist', 'tesseract.js', 'tesseract.js-core', '@tesseract.js-data/eng', '@tesseract.js-data/ron']) {
  const packageRoot = dirname(require.resolve(`${packageName}/package.json`));
  const target = join(root, 'licenses', packageName.replaceAll('/', '_').replaceAll('@', ''));
  await mkdir(target, { recursive: true });
  for (const name of await readdir(packageRoot)) if (/^(?:license|licence|notice|authors|copying|readme)(?:\.|$)/i.test(name) || name === 'package.json') await copyFile(join(packageRoot, name), join(target, name));
}
console.log('Local OCR/PDF assets prepared; no document data is involved.');
