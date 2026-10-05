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

test('the loader marks loaded ads and exposes the ad-free check for SPA navigation', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const source = html.match(/<script>\s*(\/\/ AdSense policy[\s\S]*?)<\/script>/)[1];
  const window = { location: { pathname: '/guide/card-price' } };
  vm.runInNewContext(source, {
    window,
    navigator: { userAgent: 'Mozilla/5.0' },
    document: { querySelector: () => ({ content: 'index,follow' }), createElement: () => ({}), head: { appendChild: () => {} } }
  });
  assert.equal(window.__cardPoneAdsLoaded, true);
  for (const path of ['/portfolio', '/jp/search', '/cards/kr/OP01-120', '/prices/card/1']) assert.equal(window.__cardPoneAdFreePath(path), true, path);
  for (const path of ['/', '/news', '/prices', '/cards/kr', '/guide/card-price']) assert.equal(window.__cardPoneAdFreePath(path), false, path);
});

test('in-app navigation reloads into ad-free screens once ads are loaded', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  const push = app.match(/function pushAppHistory\(url, state = \{\}\) \{[\s\S]*?\n\}/)[0];
  assert.match(push, /shouldReloadForAdFreeScreen\(url\)[\s\S]*window\.location\.assign\(url\)/);
  const pop = app.match(/const handlePopState = \(event\) => \{[\s\S]*?setRouteRevision/)[0];
  assert.match(pop, /shouldReloadForAdFreeScreen\(window\.location\.href\)[\s\S]*window\.location\.reload\(\)/);
});
