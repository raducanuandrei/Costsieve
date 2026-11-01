import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { zipSync } from 'fflate';

const root = new URL('../', import.meta.url);
const entries = {};
for (const name of ['SKILL.md', 'agents/openai.yaml', 'references/mcp.md', 'LICENSE']) {
  const source = new URL(name === 'LICENSE' ? 'LICENSE' : `skills/costsieve-audit/${name}`, root);
  entries[`costsieve-audit/${name}`] = new Uint8Array(await readFile(source));
}
const output = new URL('apps/web/public/skills/', root);
await mkdir(output, { recursive: true });
await writeFile(new URL('costsieve-audit.zip', output), zipSync(entries, { level: 6, mtime: new Date(2000, 0, 1) }));
console.log('Public CostSieve skill archive prepared; no business report is included.');
