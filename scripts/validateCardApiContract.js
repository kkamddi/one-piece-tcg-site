import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cardsPath = path.join(rootDir, 'src/data/cards.json');
const seriesPath = path.join(rootDir, 'src/data/series.json');

function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.\u30fb\u00b7]/g, '')
    .trim();
}

function searchCards(cards, { locale, q, series, scope = 'series' }) {
  const term = normalizeSearch(q);
  return cards.filter((card) => {
    if (locale && card.locale !== locale) return false;
    if (scope === 'series' && series && card.series !== series) return false;
    if (!term) return true;
    return [card.cardNo, card.name, card.type, card.effect]
      .some((value) => normalizeSearch(value).includes(term));
  });
}

function page(items, pageNumber = 1, pageSize = 60) {
  const total = items.length;
  const start = (pageNumber - 1) * pageSize;
  const cards = items.slice(start, start + pageSize);
  return {
    cards,
    page: pageNumber,
    pageSize,
    total,
    hasMore: start + cards.length < total
  };
}

function byIds(cards, ids) {
  const wanted = new Set(ids);
  return cards.filter((card) => wanted.has(card.id));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

async function main() {
  const [allCards, allSeries] = await Promise.all([readJson(cardsPath), readJson(seriesPath)]);
  const cards = allCards.filter((card) => card.locale === 'KR' || card.locale === 'JP');
  const series = allSeries.filter((item) => item.locale === 'KR' || item.locale === 'JP');
  const errors = [];
  const jpSeries = series.find((item) => item.locale === 'JP' && item.id === 'JP-OP15')
    || series.find((item) => item.locale === 'JP');
  const krSeries = series.find((item) => item.locale === 'KR' && item.id === 'KR-OP05')
    || series.find((item) => item.locale === 'KR');

  assert(Boolean(jpSeries), 'JP series is missing', errors);
  assert(Boolean(krSeries), 'KR series is missing', errors);

  const jpCurrent = page(searchCards(cards, { locale: 'JP', series: jpSeries?.id, scope: 'series' }), 1, 60);
  const krCurrent = page(searchCards(cards, { locale: 'KR', series: krSeries?.id, scope: 'series' }), 1, 60);
  const jpLuffy = page(searchCards(cards, { locale: 'JP', q: 'ルフィ', scope: 'all' }), 1, 60);
  const jpFullWidthD = searchCards(cards, { locale: 'JP', q: 'モンキー・Ｄ・ルフィ', scope: 'all' });
  const jpHalfWidthD = searchCards(cards, { locale: 'JP', q: 'モンキー・D・ルフィ', scope: 'all' });
  const krLuffy = page(searchCards(cards, { locale: 'KR', q: '루피', scope: 'all' }), 1, 60);
  const sampleIds = cards.slice(0, 10).map((card) => card.id);
  const resolvedByIds = byIds(cards, sampleIds);

  assert(jpCurrent.cards.length <= 60, 'JP current series pagination failed', errors);
  assert(krCurrent.cards.length <= 60, 'KR current series pagination failed', errors);
  assert(jpLuffy.total > 0, 'JP Japanese search returned no Luffy cards', errors);
  assert(krLuffy.total > 0, 'KR Korean search returned no Luffy cards', errors);
  assert(jpFullWidthD.length === jpHalfWidthD.length, 'JP full-width D and half-width D search counts differ', errors);
  assert(resolvedByIds.length === sampleIds.length, 'by-ids contract failed for sample IDs', errors);

  const report = {
    ok: errors.length === 0,
    errors,
    checks: {
      jpCurrentSeries: {
        series: jpSeries?.id,
        returned: jpCurrent.cards.length,
        total: jpCurrent.total,
        hasMore: jpCurrent.hasMore
      },
      krCurrentSeries: {
        series: krSeries?.id,
        returned: krCurrent.cards.length,
        total: krCurrent.total,
        hasMore: krCurrent.hasMore
      },
      jpLuffy: {
        returned: jpLuffy.cards.length,
        total: jpLuffy.total
      },
      jpFullWidthDCount: jpFullWidthD.length,
      jpHalfWidthDCount: jpHalfWidthD.length,
      krLuffy: {
        returned: krLuffy.cards.length,
        total: krLuffy.total
      },
      byIdsResolved: resolvedByIds.length
    }
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
