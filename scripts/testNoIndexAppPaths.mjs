import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// Pages Functions only run for /api/* (public/_routes.json), so page-level
// robots rules for app-only screens live in public/_headers.
test('admin and prototype screens are served with a noindex header', async () => {
  const routes = JSON.parse(await readFile(new URL('../public/_routes.json', import.meta.url), 'utf8'));
  assert.ok(!routes.include.includes('/*'), 'middleware does not see page requests');
  const headers = (await readFile(new URL('../public/_headers', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.match(headers, /^\/admin\/\*\n {2}X-Robots-Tag: noindex, nofollow$/m);
  assert.match(headers, /^\/stats-prototype\n {2}X-Robots-Tag: noindex, nofollow$/m);
});
