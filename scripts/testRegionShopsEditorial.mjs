import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  REGION_SHOP_PAGES,
  buildRegionShopEditorial,
  getRegionShopFaq,
  getRegionShopSeo,
  getRegionShopStores
} from '../lib/region-shops-editorial.js';

const shops = JSON.parse(await readFile(new URL('../src/data/shops.json', import.meta.url), 'utf8'));
const FORBIDDEN = /카드성지|더\s?카드룸/;
const compact = (value) => String(value || '').replace(/\s+/g, '');
const officialNames = new Set(shops.map((shop) => shop.name));

// Same store (name + address) listed in both official lists counts once.
function regionStores(sido) {
  const map = new Map();
  for (const shop of shops.filter((item) => item.sido === sido)) {
    const key = `${compact(shop.name)}|${compact(shop.address)}`;
    const types = map.get(key) || new Set();
    types.add(shop.sourceType);
    map.set(key, types);
  }
  return [...map.values()];
}

test('pages exist only for regions with 5 or more official stores', () => {
  assert.deepEqual(REGION_SHOP_PAGES.map((page) => page.slug), ['seoul', 'gyeonggi', 'busan', 'gyeongnam']);
  const bySido = {};
  shops.forEach((shop) => { bySido[shop.sido] = (bySido[shop.sido] || 0) + 1; });
  const eligible = Object.keys(bySido).filter((sido) => bySido[sido] >= 5).sort();
  assert.deepEqual(REGION_SHOP_PAGES.map((page) => page.sido).sort(), eligible);
  assert.equal(buildRegionShopEditorial(shops, 'daegu'), null);
});

for (const page of REGION_SHOP_PAGES) {
  test(`${page.slug}: shape, counts and rows come from shops.json`, () => {
    const editorial = buildRegionShopEditorial(shops, page.slug);
    assert.ok(editorial, page.slug);
    assert.equal(editorial.reviewedAt, '2026-10-09');
    assert.equal(editorial.dataDate, '2026-10-09');
    assert.match(editorial.heading, new RegExp(`^${page.label} 원피스카드 파는 곳: 공식 매장 \\d+곳 \\(`));
    assert.equal(editorial.paragraphs.length, 1);
    assert.equal(editorial.checklist.length, 3);
    editorial.checklist.forEach((item) => assert.ok(item.length <= 20, item));

    const expected = regionStores(page.sido);
    const official = expected.filter((types) => types.has('official')).length;
    assert.equal(editorial.summary.length, 4);
    const [total, officialTile, generalTile, topTile] = editorial.summary;
    assert.equal(total.value, `${expected.length}곳`);
    assert.equal(officialTile.value, `${official}곳`);
    assert.equal(generalTile.value, `${expected.length - official}곳`);
    assert.ok(editorial.heading.includes(`공식 매장 ${expected.length}곳`));
    assert.match(topTile.label, /^매장이 가장 많은 [구시] /);

    editorial.sections.forEach((section, index) => assert.ok(section.heading.startsWith(`${index + 1}. `), section.heading));
    assert.equal(editorial.sections.length, 3);
    for (const section of editorial.sections) {
      assert.equal(section.paragraphs.length, 1, `${section.heading}: one lead line`);
      assert.ok(section.paragraphs[0].length <= 60, `${section.heading}: short lead`);
      assert.ok(Boolean(section.table) !== Boolean(section.items), `${section.heading}: exactly one table or list`);
      if (section.table) {
        const { columns, rows } = section.table;
        rows.forEach((row) => assert.equal(row.length, columns.length, row.join(' | ')));
        assert.equal(new Set(rows.map((row) => row[0])).size, rows.length, 'row[0] is the React key');
      }
    }

    const list = editorial.sections[0].table;
    assert.deepEqual(list.columns.slice(2), ['구분', '주소']);
    assert.equal(list.rows.length, expected.length);
    list.rows.forEach(([name, , type]) => {
      assert.ok(officialNames.has(name), `${name} is on the official list`);
      assert.ok(['공인', '취급', '공인·취급'].includes(type), type);
    });
    const stores = getRegionShopStores(shops, page.slug);
    stores.forEach((store) => assert.equal(store.sido, page.sido, store.name));
    const sorted = [...stores].sort((a, b) => a.area.localeCompare(b.area, 'ko') || a.name.localeCompare(b.name, 'ko'));
    assert.deepEqual(stores.map((store) => store.name), sorted.map((store) => store.name));

    const byArea = editorial.sections[1].table;
    assert.equal(byArea.rows.reduce((sum, row) => sum + Number(row[1]), 0), expected.length);
    byArea.rows.forEach((row) => assert.equal(Number(row[1]), Number(row[2]) + Number(row[3]), row[0]));
    assert.ok(topTile.label.includes(`${byArea.rows[0][1]}곳`));

    const visit = editorial.sections[2];
    assert.ok(visit.items.length <= 3);
    visit.items.forEach((item) => assert.ok(item.length <= 40, item));
    assert.deepEqual(visit.links.map((link) => link.href), ['/shops', '/guide/shops']);
  });

  test(`${page.slug}: SEO and FAQ`, () => {
    const editorial = buildRegionShopEditorial(shops, page.slug);
    const seo = getRegionShopSeo(shops, page.slug);
    const count = regionStores(page.sido).length;
    assert.equal(seo.title, `${page.label} 원피스카드 파는 곳 - 공식 공인점포·취급점포 ${count}곳 | Card Pone`);
    assert.ok(seo.description.length <= 160, seo.description);
    assert.ok(seo.keywords.startsWith(`${page.label} 원피스카드, `));

    const faq = getRegionShopFaq(shops, page.slug);
    assert.equal(faq.length, 2);
    faq.forEach((entry) => {
      assert.equal(entry.length, 2);
      entry.forEach((text) => assert.equal(typeof text, 'string'));
    });
    assert.ok(faq[0][1].includes(`${count}곳`));

    const text = JSON.stringify({ editorial, seo, faq });
    assert.doesNotMatch(text, FORBIDDEN);
    assert.doesNotMatch(text, /\d{2,4}-\d{3,4}-\d{4}|영업시간은 \d|\d{1,2}시\s?~|재고 있음/, 'no invented phone numbers, hours or stock');
  });
}

test('the Seoul 용산 FAQ follows the data', () => {
  const faq = getRegionShopFaq(shops, 'seoul');
  const yongsan = shops.filter((shop) => shop.sido === '서울특별시' && shop.gungu === '용산구');
  assert.match(faq[1][0], /용산/);
  if (!yongsan.length) assert.match(faq[1][1], /용산구 매장은 없습니다/);
  else yongsan.forEach((shop) => assert.ok(faq[1][1].includes(shop.name)));
});
