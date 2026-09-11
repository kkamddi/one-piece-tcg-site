import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { transform } from 'esbuild';
import { getPageSeo } from '../functions/_middleware.js';

const source = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const news = ast.program.body.find(node => node.id?.name === 'RenewNews');
const declarations = news.body.body.flatMap(node => node.declarations || []);
const initializer = name => declarations.find(node => node.id.name === name || node.id.elements?.[0]?.name === name).init;
const expression = node => source.slice(node.start, node.end);
const filters = ast.program.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'NEWS_FILTERS').init;
const routeState = ast.program.body.find(node => node.id?.name === 'getNewsRouteState');
const paths = ['/news', '/news/official', '/news/guide', '/news/preorder', '/news/supplies'];

test('news tabs expose distinct existing route URLs', () => {
  const rows = vm.runInNewContext(expression(filters));
  assert.deepEqual(Array.from(rows, row => row.href), paths);
});

test('the URL selects the news category instead of a stale history filter', () => {
  for (const [path, search, section, mode] of [
    ['/news', '', 'all', 'guide'],
    ['/news/official', '', 'notice', 'guide'],
    ['/news/guide', '', 'guide', 'guide'],
    ['/news/faq', '', 'guide', 'qa'],
    ['/news/preorder', '', 'preorder', 'guide'],
    ['/news/preorder', '?section=notice', 'preorder', 'guide'],
    ['/news/supplies', '', 'supplies', 'guide'],
    ['/news', '?section=preorder', 'preorder', 'guide'],
    ['/news', '?section=guide&mode=qa', 'guide', 'qa']
  ]) {
    const context = vm.createContext({
      URLSearchParams, initialPath: path, initialParams: new URLSearchParams(search), isAndroid: false,
      savedViewState: { newsFilter: 'supplies', guideQaMode: 'qa' }, useState: init => init(), getAppPath: value => value
    });
    vm.runInContext(`NEWS_FILTERS = ${expression(filters)}; ${expression(routeState)}; initialRouteState = getNewsRouteState(initialPath, initialParams.toString()); routeSection = ${expression(initializer('routeSection'))}; initialSection = ${expression(initializer('initialSection'))};`, context);
    assert.equal(vm.runInContext(expression(initializer('newsFilter')), context), section, path + search);
    assert.equal(vm.runInContext(expression(initializer('guideQaMode')), context), mode, path + search);
    if (section === 'supplies') {
      context.isAndroid = true;
      assert.equal(vm.runInContext(expression(initializer('newsFilter')), context), 'guide');
    }
  }
});

test('category links keep modified clicks native and use app navigation for ordinary clicks', () => {
  const follow = news.body.body.find(node => node.id?.name === 'followNewsLink');
  const visited = [];
  const context = vm.createContext({ onNavigate: href => visited.push(href) });
  vm.runInContext(expression(follow), context);
  for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    context.followNewsLink({ button: 0, preventDefault() { assert.fail('modified click intercepted'); }, ...modifiers }, '/news/guide');
  }
  assert.equal(visited.length, 0);
  let prevented = false;
  context.followNewsLink({ button: 0, preventDefault() { prevented = true; } }, '/news/guide');
  assert.equal(prevented, true);
  assert.deepEqual(visited, ['/news/guide']);
});

test('category URLs have static HTML entries and matching client/server titles', async () => {
  const generator = await readFile(new URL('./generateStaticSeoPages.js', import.meta.url), 'utf8');
  const generatorAst = parse(generator, { sourceType: 'module' });
  const required = generatorAst.program.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'requiredPaths').init;
  const entries = vm.runInNewContext(generator.slice(required.start, required.end));
  const seoNode = ast.program.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'CLIENT_ROUTE_SEO').init;
  const clientSeo = vm.runInNewContext(`(${expression(seoNode)})`);
  for (const path of [...paths, '/news/faq']) {
    assert.ok(entries.includes(path), path);
    assert.ok(getPageSeo(path), path);
    if (path !== '/news') assert.equal(clientSeo[path].title.split('|')[0].trim(), getPageSeo(path).title.split('|')[0].trim(), path);
  }
  assert.match(source, /<RenewNews\s+key=\{`\$\{window\.location\.pathname\}\$\{window\.location\.search\}`\}/);
  await transform(source, { loader: 'jsx' });
});
