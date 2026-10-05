import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

// Runs the ad loader from index.html against a fake page and reports whether it injects adsbygoogle.
async function loadsAds(pathname, robots = 'index,follow', userAgent = 'Mozilla/5.0') {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const source = html.match(/<script>\s*(\/\/ AdSense policy[\s\S]*?)<\/script>/)[1];
  let injected = false;
  const context = {
    window: { location: { pathname } },
    navigator: { userAgent },
    document: {
      querySelector: () => ({ content: robots }),
      createElement: () => ({}),
      head: { appendChild: () => { injected = true; } }
    }
  };
  vm.runInNewContext(source, context);
  return injected;
}

test('content pages load the AdSense script', async () => {
  for (const path of ['/', '/guide/card-price', '/guides/series/krop09', '/jp/guides/series/jpop06', '/cards/kr', '/prices']) {
    assert.equal(await loadsAds(path), true, path);
  }
});

test('noindex pages, app screens and card detail shells do not load ads', async () => {
  assert.equal(await loadsAds('/news/preorder', 'noindex,follow'), false);
  for (const path of ['/portfolio', '/search', '/admin/analytics', '/stats-prototype', '/lab/card-world-cup', '/cards/kr/OP01-120', '/jp/cards/jp/OP01-120-p1', '/prices/product/93512']) {
    assert.equal(await loadsAds(path), false, path);
  }
  assert.equal(await loadsAds('/', 'index,follow', 'Mozilla/5.0 CardPoneAndroid/1.0'), false);
});
