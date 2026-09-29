import assert from 'node:assert/strict';
import test from 'node:test';
import { build, transform } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { filterShows, reviewedShows, koreaToday, showRoute, safeEventUrl } from '../src/card-shows.js';
import { cardShowEvents } from '../src/data/card-show-events.js';

const base = { id: 'test', title: 'Test show', titleKo: '시험 행사', date: '2026-10-02', endDate: '2026-10-03',
  locale: 'KR', region: 'capital', venue: '서울 시험 행사장', url: 'https://example.com/',
  verifiedAt: '2026-09-29', sourceLabel: '주최 측', status: 'confirmed' };
const events = [base, { ...base, id: 'past', date: '2026-09-01', endDate: '2026-09-02', region: 'other' },
  { ...base, id: 'later', date: '2026-11-01', endDate: '2026-11-01', status: 'cancelled' }];
const compiled = await build({ entryPoints: ['src/CardShows.jsx'], bundle: true, write: false, platform: 'node',
  format: 'cjs', packages: 'external', loader: { '.css': 'empty' } });
const context = { module: { exports: {} }, require: createRequire(import.meta.url), URL, URLSearchParams };
vm.runInNewContext(compiled.outputFiles[0].text, context);
const Component = context.module.exports.default;
const render = props => renderToStaticMarkup(React.createElement(Component, { events, today: '2026-10-02', ...props }));

test('reviewed official images have attribution; missing or unsafe images leave no placeholder', () => {
  const pictured = { ...base, posterUrl: 'https://example.com/poster.png', posterSourceUrl: 'https://example.com/', posterVerifiedAt: '2026-09-29' };
  assert.match(render({ events: [pictured] }), /<img/);
  assert.match(render({ events: [pictured], search: '?event=test' }), /이미지 출처/);
  for (const patch of [{ posterUrl: 'javascript:alert(1)' }, { posterUrl: 'https://other.example/poster.png' }, { posterVerifiedAt: '' }]) {
    assert.doesNotMatch(render({ events: [{ ...pictured, ...patch }] }), /<img|card-show-poster/);
  }
  const element = Component({ events: [pictured], today: '2026-10-02' });
  const walk = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(walk)];
  const image = walk(element).find(node => node.type === 'img');
  const target = { hidden: false };
  image.props.onError({ currentTarget: target });
  assert.equal(target.hidden, true);
});

test('curated list contains both verified shows and discloses conflicting opening times', () => {
  assert.equal(filterShows(cardShowEvents, { today: '2026-09-29' }).length, 2);
  const html = render({ events: cardShowEvents, search: '?event=cardshow-collectible-con-20261002' });
  assert.match(html, /10:00/);
  assert.match(html, /11:00/);
  assert.match(html, /사전등록/);
});

test('KST day boundary and multi-day events retain ongoing shows until the end date', () => {
  assert.equal(koreaToday(Date.parse('2026-10-01T15:00:00Z')), '2026-10-02');
  assert.deepEqual(filterShows(events, { today: '2026-10-03' }).map(e => e.id), ['test', 'later']);
  assert.deepEqual(filterShows(events, { today: '2026-10-04', tab: 'past' }).map(e => e.id), ['test', 'past']);
  assert.deepEqual(filterShows(events, { today: '2026-10-02', region: 'other' }), []);
});
test('unreviewed, foreign and invalid records are never visible, but verified cancellation remains visible', () => {
  assert.equal(reviewedShows([{ ...base, reviewRequired: true }, { ...base, status: 'pending' }, { ...base, locale: 'JP' }, { ...base, date: '2026-02-30' }]).length, 0);
  assert.equal(reviewedShows(events).length, 3);
});
test('list prioritizes event details and leaves unknown fees to the detail view', () => {
  const html = render({});
  assert.match(html, /카드쇼·행사/);
  assert.match(html, /진행 중/);
  assert.doesNotMatch(html, /입장료 미확인/);
  assert.match(html, /취소/);
  assert.doesNotMatch(html, /<img|>원피스<|past</);
});
test('detail preserves filter context and suppresses registration for cancelled/past events', () => {
  const html = render({ search: '?section=cardshows&event=later&region=capital', events: events.map(e => ({ ...e, registrationUrl: 'https://example.com/register' })) });
  assert.match(html, /region=capital/);
  assert.match(html, /공식 안내/);
  assert.match(html, /마지막 확인/);
  assert.match(html, /입장료 미확인/);
  assert.doesNotMatch(html, /예매·등록/);
  assert.match(render({ search: '?section=cardshows&event=missing' }), /행사를 찾을 수 없습니다/);
  assert.match(render({ search: '?section=cardshows&region=other' }), /확인된 예정 행사가 없습니다/);
});
test('external link guard rejects scripts and credentials; detail uses React escaping', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com']) assert.equal(safeEventUrl(url), '');
  const html = render({ search: '?event=test', events: [{ ...base, titleKo: '<script>test</script>', registrationUrl: 'javascript:alert(1)' }] });
  assert.doesNotMatch(html, /<script>|javascript:/);
  assert.match(html, /&lt;script&gt;/);
});
test('internal links are shareable and respect modified clicks; news JSX still compiles', async () => {
  const url = showRoute({ tab: 'past', region: 'other', id: 'a&b' });
  assert.equal(new URLSearchParams(url.split('?')[1]).get('event'), 'a&b');
  const calls = [];
  const element = Component({ events, today: '2026-10-02', onNavigate: href => calls.push(href) });
  const walk = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(walk)];
  const link = walk(element).find(node => node.props?.className === 'card-show-row');
  let prevented = false;
  link.props.onClick({ button: 0, preventDefault: () => { prevented = true; } });
  assert.equal(calls.length, 1); assert.equal(prevented, true);
  link.props.onClick({ button: 0, ctrlKey: true, preventDefault: () => assert.fail('modified click intercepted') });
  assert.equal(calls.length, 1);
  const regionSelect = walk(element).find(node => node.type === 'select');
  regionSelect.props.onChange({ target: { value: 'capital' } });
  assert.equal(calls.at(-1), '/news?section=cardshows&region=capital');
  assert.match(render({}), /renew-news-toggle/);
  await transform(await readFile('src/RenewApp.jsx', 'utf8'), { loader: 'jsx' });
});

test('actual localized news navigation retains section, selected event and filters', async () => {
  const source = await readFile('src/RenewApp.jsx', 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const names = ['normalizeSitePath', 'getAppPath', 'localizeAppPath', 'localizeNewsPath', 'getNewsRouteState'];
  const code = ast.program.body.filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name))
    .map(node => source.slice(node.start, node.end)).join('\n');
  const scope = { URLSearchParams, JAPANESE_ROUTE_PREFIX: '/jp' };
  vm.runInNewContext(code, scope);
  const path = showRoute({ tab: 'past', region: 'capital', id: 'test' });
  assert.equal(scope.localizeNewsPath(path, 'KR'), path);
  assert.equal(scope.localizeNewsPath(path, 'JP'), `/jp${path}`);
  assert.equal(scope.getNewsRouteState('/news', path.slice(path.indexOf('?'))).section, 'cardshows');
});
