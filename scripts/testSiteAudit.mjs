import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { transform } from 'esbuild';

const portfolioSource = await readFile(new URL('../src/PortfolioCalculator.jsx', import.meta.url), 'utf8');
const portfolioCode = (await transform(portfolioSource, { loader: 'jsx', format: 'cjs' })).code;
const searchSource = await readFile(new URL('../src/SiteSearch.jsx', import.meta.url), 'utf8');
const searchAst = parse(searchSource, { sourceType: 'module', plugins: ['jsx'] });
const inputNode = searchAst.program.body.find(node => node.declaration?.id?.name === 'SiteSearchInput').declaration;
const inputCode = (await transform(searchSource.slice(inputNode.start, inputNode.end), { loader: 'jsx' })).code;

// Run component event handlers with deterministic hooks; no account or network writes.
function harness(code, name, props, extras = {}) {
  const states = [], effects = [], memos = [];
  let cursor = 0, jobs = [], tree;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const old = effects[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        jobs.push(() => { old?.cleanup?.(); effects[index] = { deps, cleanup: effect() }; });
      }
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!memos[index] || deps.some((value, i) => !Object.is(value, memos[index].deps[i]))) memos[index] = { deps, value: factory() };
      return memos[index].value;
    },
    useId: () => 'test-search',
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) })
  };
  const context = vm.createContext({ ...hooks, React: hooks, module: { exports: {} }, require: () => hooks, ...extras });
  vm.runInContext(`${code}\nthis.component = typeof ${name} === 'function' ? ${name} : module.exports.default;`, context);
  function render() { cursor = 0; jobs = []; tree = context.component(props); const pending = jobs; jobs = []; pending.forEach(job => job()); return tree; }
  function nodes(predicate, node = tree) {
    if (!node || typeof node !== 'object') return [];
    return [...(predicate(node) ? [node] : []), ...(node.children || []).filter(Boolean).flatMap(child => nodes(predicate, child))];
  }
  function text(node) { return typeof node === 'string' || typeof node === 'number' ? String(node) : (node?.children || []).map(text).join(''); }
  return { render, nodes, text, button: label => nodes(node => node.type === 'button' && text(node) === label)[0] };
}

test('IME confirmation does not submit or navigate an active search suggestion', () => {
  const navigations = [], submitted = [];
  const app = harness(inputCode, 'SiteSearchInput', { onSubmit: value => submitted.push(value), initialQuery: '루피' }, {
    LABELS: { KR: { placeholder: 'Search', submit: 'Search' } }, series: [],
    searchSiteContent: () => [{ id: 'guide', title: 'Guide', href: '/guide/collection', type: 'guides' }],
    setTimeout: () => 1, clearTimeout() {}, window: { location: { assign: href => navigations.push(href) } }
  });
  app.render();
  const input = () => app.nodes(node => node.type === 'input')[0];
  input().props.onFocus(); app.render();
  input().props.onKeyDown({ key: 'ArrowDown', nativeEvent: {}, preventDefault() {} }); app.render();
  for (const nativeEvent of [{ isComposing: true }, { keyCode: 229 }]) {
    let prevented = false;
    input().props.onKeyDown({ key: 'Enter', nativeEvent, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.deepEqual(navigations, []);
  }
  input().props.onKeyDown({ key: 'Enter', nativeEvent: {}, preventDefault() {} });
  assert.deepEqual(navigations, ['/guide/collection']);
  app.nodes(node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.deepEqual(submitted, ['루피']);
});

async function calculator() {
  const requests = [], saved = [];
  const cards = [{ id: 'a', cardNo: 'OP01-120', name: 'First' }, { id: 'b', cardNo: 'OP01-120', name: 'Second' }];
  const app = harness(portfolioCode, 'PortfolioCalculator', {
    authUser: { id: 'test-only' }, onSearchCards: async () => cards,
    onLoadQuote: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    onSave: async value => saved.push(value)
  });
  app.render();
  app.nodes(node => node.props.id === 'portfolio-calculator-search')[0].props.onChange({ target: { value: 'OP01-120' } });
  app.render();
  await app.nodes(node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  app.render();
  const choose = index => {
    app.nodes(node => node.type === 'button' && node.props.key === cards[index].id)[0].props.onClick(); app.render();
  };
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); app.render(); };
  choose(0);
  requests[0].resolve({ apparelId: 1, prices: { a: 1000 } });
  await settle();
  app.nodes(node => node.type === 'input' && node.props.min === '0')[0].props.onChange({ target: { value: '1000' } });
  app.render();
  return { app, requests, saved, choose, settle };
}

test('changing cards clears the old quote and disables detail/save until the new quote resolves', async () => {
  const { app, choose, requests, settle, saved } = await calculator();
  assert.equal(app.button('시세 상세 보기').props.disabled, false);
  assert.equal(app.button('포트폴리오에 저장').props.disabled, false);
  choose(1); app.render();
  assert.equal(app.button('시세 상세 보기').props.disabled, true);
  assert.equal(app.button('포트폴리오에 저장').props.disabled, true);
  const preview = app.nodes(node => node.props.className?.includes('renew-portfolio-calculator-preview'))[0];
  assert.ok(!app.text(preview).includes('₩9,400'));
  await app.button('포트폴리오에 저장').props.onClick();
  assert.equal(saved.length, 0);
  requests[1].resolve({ apparelId: 2, prices: { a: 2000 } }); await settle();
  assert.equal(app.button('시세 상세 보기').props.disabled, false);
  await app.button('포트폴리오에 저장').props.onClick();
  assert.equal(saved[0].card.id, 'b');
  assert.equal(saved[0].quote.apparelId, 2);
});

test('a failed replacement quote cannot restore the previous card price', async () => {
  const { app, choose, requests, settle } = await calculator();
  choose(1);
  requests[1].reject(new Error('test offline')); await settle();
  assert.equal(app.button('시세 상세 보기').props.disabled, true);
  assert.equal(app.button('포트폴리오에 저장').props.disabled, true);
});

test('late responses for a previous selection cannot overwrite the current quote', async () => {
  const { app, choose, requests, settle, saved } = await calculator();
  choose(1); choose(0);
  requests[2].resolve({ apparelId: 3, prices: { a: 3000 } }); await settle();
  requests[1].resolve({ apparelId: 2, prices: { a: 2000 } }); await settle();
  await app.button('포트폴리오에 저장').props.onClick();
  assert.equal(saved[0].card.id, 'a');
  assert.equal(saved[0].quote.apparelId, 3);
});
