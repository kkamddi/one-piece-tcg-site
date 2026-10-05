import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { withNoIndex } from '../functions/_middleware.js';

test('admin and prototype screens are served with noindex', async () => {
  const middleware = await readFile(new URL('../functions/_middleware.js', import.meta.url), 'utf8');
  assert.match(middleware, /const APP_ONLY_PATHS = new Set\(\['\/admin\/analytics', '\/stats-prototype'\]\);/);
  assert.match(middleware, /if \(isAppOnlyPath\(url\.pathname\)\) return withNoIndex\(await context\.next\(\)\);/);
  const response = await withNoIndex(new Response('<head><meta name="robots" content="index,follow,max-snippet:-1" /></head>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.match(await response.text(), /<meta name="robots" content="noindex,nofollow" \/>/);
});
