import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { BOOSTER_PREVIEWS, getBoosterPreview, getPreviewCards, groupPreviewCards, parsePreviewCard } from '../lib/booster-preview.js';
import { getBoosterPreviewEntries } from './boosterPreviewSeo.js';

const item = (apparelId, code, name, setName = 'Extra Booster "Heroines Edition Vol.2"') => ({ apparelId, code, locale: 'JP', name: `${name} [${code}](${setName})`, setName, previewImageUrl: `https://img/${apparelId}.webp` });
const [eb05, op18] = BOOSTER_PREVIEWS;

test('SNKRDUNK product names are read into name, rarity and version group', () => {
  assert.deepEqual([
    item(1, 'EB05-010', 'Nico Robin L-SP (Manga Alt Art)'),
    item(2, 'EB05-006', 'Miss Buckingham Stussy SR-SPC'),
    item(3, 'EB05-061', 'Nami SEC-P'),
    item(4, 'OP11-041', 'Nami L'),
    item(5, 'EB05-055', 'Nami (Kentaro Yabuki) SR-P :Foil Stamped'),
    item(6, 'EB05-057', 'Nojiko R-P')
  ].map(parsePreviewCard).map(card => [card.name, card.rarity, card.group, card.note]), [
    ['니코 로빈', 'L-SP', '슈퍼 리더 패러렐', ''],
    ['스투시', 'SR-SPC', 'SP', ''],
    ['나미', 'SEC-P', 'SEC', ''],
    ['나미', 'L', '리더', ''],
    ['나미', 'SR-P', '특별 일러스트', '야부키 켄타로 일러스트 · 박 버전'],
    ['노지코', 'R-P', '패러렐', '']
  ]);
});

test('each preview only collects its own set, skips DON!! and lists manga first', () => {
  const market = [
    item(10, 'EB05-057', 'Nojiko R-P'),
    item(11, 'EB05-010', 'Nico Robin L-SP (Manga Alt Art)'),
    item(12, 'OPC-TCG-EB-05-DON', 'DON!! Card (Nami & Robin)'),
    item(13, 'EB03-026', 'Boa Hancock SR-SPC', 'Extra Booster "ONE PIECE Heroines edition"'),
    item(14, 'OP18-001', 'Some Leader L', 'Booster Pack "NEW SET"')
  ];
  assert.deepEqual(getPreviewCards(eb05, market).map(card => card.apparelId), [11, 10]);
  assert.deepEqual(groupPreviewCards(getPreviewCards(eb05, market)).map(entry => entry.group), ['슈퍼 리더 패러렐', '패러렐']);
  assert.deepEqual(getPreviewCards(op18, market).map(card => card.apparelId), [14]);
});

test('preview pages are routed, listed, searchable, pre-rendered and in the sitemap', async () => {
  const [app, sitemap, search, generator] = await Promise.all(['../src/RenewApp.jsx', './generatePrimarySitemap.js', '../src/lib/site-search.js', './generateStaticSeoPages.js'].map(file => readFile(new URL(file, import.meta.url), 'utf8')));
  assert.match(app, /const boosterPreview = getBoosterPreview\(initialPath\);/);
  assert.match(app, /boosterPreview \? <RenewBoosterPreview preview=\{boosterPreview\} \/> : null/);
  assert.match(generator, /boosterPreviewSeo\.get\(pathname\)/);
  for (const preview of BOOSTER_PREVIEWS) {
    const path = `/guide/preview/${preview.slug}`;
    assert.equal(getBoosterPreview(path), preview);
    assert.match(sitemap, new RegExp(`'${path}'`));
    assert.match(search, new RegExp(`href: '${path}'`));
  }
  const entries = getBoosterPreviewEntries();
  assert.deepEqual(entries.map(entry => entry.pathname), ['/guide/preview/eb-05', '/guide/preview/op-18']);
  assert.match(entries[0].seo.sections[1].heading, /^공개된 카드 \d+장$/);
});

test('previews keep text short and make no pull-rate or price promise', () => {
  for (const preview of BOOSTER_PREVIEWS) {
    assert.equal(preview.facts.length, 4);
    assert.ok(preview.lead.length <= 80, preview.slug);
    assert.ok(preview.notes.length <= 3, preview.slug);
    const text = JSON.stringify(preview);
    assert.doesNotMatch(text, /봉입률은 (약|대략)|\d+박스에 1장|오를 것|수익/);
    assert.match(text, /봉입률은 공식 자료가 없습니다/);
  }
});
