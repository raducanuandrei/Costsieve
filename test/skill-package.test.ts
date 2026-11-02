import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

test('downloadable skill is complete, static and contains exactly its public source files', async () => {
  const root = new URL('..', import.meta.url);
  const archive = unzipSync(await readFile(new URL('apps/web/public/skills/costsieve-audit.zip', root)));
  const files = ['SKILL.md', 'agents/openai.yaml', 'references/mcp.md', 'LICENSE'];
  assert.deepEqual(Object.keys(archive).sort(), files.map(name => `costsieve-audit/${name}`).sort());
  for (const name of files) {
    const expected = await readFile(new URL(name === 'LICENSE' ? 'LICENSE' : `skills/costsieve-audit/${name}`, root), 'utf8');
    assert.equal(strFromU8(archive[`costsieve-audit/${name}`]!), expected);
  }
  const skill = strFromU8(archive['costsieve-audit/SKILL.md']!);
  assert.match(skill, /^---\r?\nname: costsieve-audit\r?\ndescription: Use when /);
  assert.ok(skill.slice(0, skill.indexOf('---', 4)).length < 1024);
  assert.match(strFromU8(archive['costsieve-audit/agents/openai.yaml']!), /\$costsieve-audit/);
});
