import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDraft, findNewReleases, getReferenceCards, parseProductPage, parseProductUrl, renderAutoModule } from './draftBoosterPreview.mjs';
import { BOOSTER_PREVIEWS } from '../lib/booster-preview.js';
import { autoBoosterPreviews } from '../src/data/booster-previews.auto.js';

const page = (heading, rows, extra = '') => `<div class="sliderCol"><img data-src="/onepiececg/bccard/jp/products/2027/01/10/abc/img_item01.webp"></div>${extra}
<div class="detailColStatus"><h4>${heading}</h4>${rows.map(([dt, dd]) => `<dl><dt>${dt}</dt><dd>${dd}</dd></dl>`).join('')}</div>`;
const op19 = page('ブースターパック 新しい冒険【OP-19】', [['発売日', '2027年2月27日(土)'], ['メーカー希望小売価格', '240円(税込)'], ['内容', '1パック：カード6枚（全127種+1種）']]);
const eb06 = page('エクストラブースター 何か【EB-06】', [['発売日', '2027年4月3日(土)'], ['メーカー希望小売価格', '240円(税込)'], ['内容', '<p>1パック：カード6枚（全75種+2種）</p>'], ['レアリティ', 'リーダーカード：7種、コモン：29種、レア：21種、スーパーレア：9種、シークレットレア：1種、スペシャルカード：8種、ドン!!カード：2種']],
  '<img src="/onepiececg/bccard/jp/products/2027/03/01/xyz/img_features_01.webp">');
const hitCards = { sets: { OP18: { hitCards: [1, 2, 3, 4, 5].map((n) => ({ apparelId: n, name: `카드${n}`, version: 'SR 망가', singleJpy: 1000 * n, singleDate: `2027-02-0${n}`, image: `https://img/${n}.webp` })) } } };

test('the product block gives date, price, kinds, rarity table and image', () => {
  const parsed = parseProductPage(eb06);
  assert.equal(parsed.heading, 'エクストラブースター 何か【EB-06】');
  assert.equal(parsed.releaseDate, '2027-04-03');
  assert.equal(parsed.priceYen, 240);
  assert.equal(parsed.kinds, 75);
  assert.equal(parsed.extraKinds, 2);
  assert.deepEqual(parsed.rarityCounts, ['7', '29', '', '21', '9', '1', '8']);
  assert.match(parsed.image, /img_features_01\.webp$/);
  assert.match(parseProductPage(op19).image, /img_item01\.webp$/, 'falls back to the product gallery');
});

test('only upcoming JP boosters without a preview or a catalog set are picked up', () => {
  const topics = [
    { source: 'JP_OFFICIAL', calendarKind: 'release', scheduleDate: '2027-02-27', url: 'https://www.onepiece-cardgame.com/products/op19.html', title: 'OP-19' },
    { source: 'JP_OFFICIAL', calendarKind: 'release', scheduleDate: '2026-11-21', url: 'https://www.onepiece-cardgame.com/products/op18.html', title: 'OP-18' },
    { source: 'JP_OFFICIAL', calendarKind: 'release', scheduleDate: '2027-03-01', url: 'https://www.onepiece-cardgame.com/products/st31.html', title: 'ST' },
    { source: 'JP_OFFICIAL', calendarKind: 'release', scheduleDate: '2026-05-30', url: 'https://www.onepiece-cardgame.com/products/op16.html', title: 'past' },
    { source: 'KR_OFFICIAL', calendarKind: 'release', scheduleDate: '2027-02-27', url: 'https://www.onepiece-cardgame.com/products/op20.html', title: 'KR' },
    { source: 'JP_OFFICIAL', category: '商品情報', date: '2027-01-10', url: 'https://www.onepiece-cardgame.com/products/eb06.html', title: 'news, not a release' }
  ];
  const found = findNewReleases(topics, { series: [{ locale: 'JP', baseSeriesId: 'OP17' }], previews: [{ slug: 'op-18' }], today: '2026-10-12' });
  assert.deepEqual(found.map((item) => item.code), ['OP-19']);
  assert.equal(parseProductUrl('/products/prb03.html').slug, 'prb-03');
});

test('a draft is hidden until reviewed and follows the preview text rules', () => {
  const product = { ...parseProductUrl('/products/op19.html'), releaseDate: '2027-02-27' };
  const draft = buildDraft(product, parseProductPage(op19), getReferenceCards(product, hitCards), '2027-01-10');
  assert.equal(draft.status, 'draft');
  assert.equal(draft.title, 'OP-19 新しい冒険 프리뷰');
  assert.equal(draft.facts.length, 4);
  assert.deepEqual(draft.facts.map((fact) => fact.value), ['2월 27일', '240엔', '127종', '정규 부스터']);
  assert.ok(draft.lead.length <= 80);
  assert.match(JSON.stringify(draft), /봉입률은 공식 자료가 없습니다/);
  assert.deepEqual(draft.reference.cards.map((card) => card.apparelId), [5, 4, 3, 2], 'four most expensive, highest first');
  assert.equal(draft.reference.title, '직전 OP-18에서 비싼 카드');
  assert.equal(draft.codePattern, '^OP19-');
  assert.deepEqual(draft.missing, []);
  const empty = buildDraft(product, { heading: 'ブースターパック 【OP-19】' }, getReferenceCards(product, {}), '2027-01-10');
  assert.ok(empty.missing.includes('가격') && empty.missing.includes('직전 OP-18 참고 카드'));
});

test('drafts never reach the site; published ones join the preview list', async () => {
  for (const preview of autoBoosterPreviews) assert.ok(['draft', 'published'].includes(preview.status), preview.slug);
  const draftSlugs = autoBoosterPreviews.filter((preview) => preview.status !== 'published').map((preview) => preview.slug);
  for (const slug of draftSlugs) assert.ok(!BOOSTER_PREVIEWS.some((preview) => preview.slug === slug && preview.autoDrafted), slug);
  const product = { ...parseProductUrl('/products/op19.html'), releaseDate: '2027-02-27' };
  const draft = buildDraft(product, parseProductPage(op19), getReferenceCards(product, hitCards), '2027-01-10');
  const module = await import(`data:text/javascript,${encodeURIComponent(renderAutoModule([draft]))}`);
  assert.equal(module.autoBoosterPreviews[0].status, 'draft');
});
