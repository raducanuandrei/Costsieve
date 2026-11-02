import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production static assets ship browser isolation, transport and injection protections', async () => {
  const text = await readFile(new URL('../apps/web/public/_headers', import.meta.url), 'utf8');
  const headers = new Map(text.split(/\r?\n/).filter(line => /^\s+[^:]+:/.test(line)).map(line => {
    const colon = line.indexOf(':'); return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
  }));
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('referrer-policy'), 'no-referrer');
  assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(headers.get('strict-transport-security'), 'max-age=2592000');
  const csp = headers.get('content-security-policy')!;
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /connect-src 'self' blob:/);
  const scripts = csp.split(';').find(value => value.trim().startsWith('script-src '))!;
  assert.doesNotMatch(scripts, /'unsafe-inline'|'unsafe-eval'|https?:|\*/);
});
