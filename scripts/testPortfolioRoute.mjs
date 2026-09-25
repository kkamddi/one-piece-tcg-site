import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { applySeo, getPageSeo, onRequest } from '../functions/_middleware.js';

const source = await readFile(new URL('./generateStaticSeoPages.js', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module' });
const routes = ast.program.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'requiredPaths');
const requiredPaths = vm.runInNewContext(source.slice(routes.init.start, routes.init.end));
const shell = '<!doctype html><html lang="ko"><head><title>App</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';

test('portfolio direct-entry routes are generated even though they are not in a sitemap', () => {
  for (const pathname of ['/portfolio', '/jp/portfolio']) {
    assert.ok(requiredPaths.includes(pathname));
    const seo = getPageSeo(pathname);
    assert.ok(seo);
    const html = applySeo(shell, pathname, seo);
    assert.match(html, /name="robots" content="noindex,follow"/);
    assert.match(html, /src="\/assets\/app.js"/);
  }
});

test('portfolio entry does not become a 404 while genuinely unknown routes still do', async () => {
  for (const pathname of ['/portfolio', '/portfolio/', '/jp/portfolio']) {
    const result = await onRequest({ request: new Request(`https://www.optcgkorea.com${pathname}`),
      next: () => new Response(shell, { headers: { 'Content-Type': 'text/html' } }) });
    assert.equal(result.status, 200);
    assert.match(await result.text(), /name="robots" content="noindex,follow"/);
  }
  const missing = await onRequest({ request: new Request('https://www.optcgkorea.com/missing-page'),
    next: () => { throw new Error('unexpected fallback'); } });
  assert.equal(missing.status, 404);
});

test('the real static generator emits portfolio HTML using only in-memory filesystem fixtures', () => {
  const writes = new Map();
  const context = vm.createContext({ path, fileURLToPath, applySeo, getPageSeo,
    getSeriesGuideEntries: () => [], getBoxRecommendationEntries: () => [],
    console: { log() {} },
    fs: { existsSync: () => true, mkdirSync() {},
      readFileSync: file => file.endsWith('index.html') ? shell : '',
      writeFileSync: (file, html) => writes.set(file.replaceAll('\\', '/'), html) }
  });
  const code = source.replace(/^import .+;\r?$/gm, '')
    .replaceAll('import.meta.url', JSON.stringify(new URL('./generateStaticSeoPages.js', import.meta.url).href));
  vm.runInContext(code, context);
  for (const suffix of ['/dist/portfolio.html', '/dist/jp/portfolio.html']) {
    const output = [...writes].find(([file]) => file.endsWith(suffix));
    assert.ok(output, suffix);
    assert.match(output[1], /name="robots" content="noindex,follow"/);
    assert.match(output[1], /src="\/assets\/app.js"/);
  }
  assert.ok([...writes.keys()].some(file => file.endsWith('/dist/404.html')));
});
