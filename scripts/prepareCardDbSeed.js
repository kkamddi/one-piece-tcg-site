import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cardsPath = path.join(rootDir, 'src/data/cards.json');
const seriesPath = path.join(rootDir, 'src/data/series.json');
const outDir = path.join(rootDir, 'data/supabase-card-seed');

function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.\u30fb\u00b7]/g, '')
    .trim();
}

function baseCardNo(cardNo = '') {
  return String(cardNo)
    .trim()
    .replace(/_[pr]\d+$/i, '')
    .replace(/_P\d+$/i, '');
}

function variantKey(cardNo = '', id = '') {
  const cleanId = String(id).split('::')[1] || '';
  const cleanCardNo = String(cardNo).trim();
  if (cleanId && cleanId !== cleanCardNo) {
    const suffix = cleanId.replace(cleanCardNo, '').replace(/^[_-]/, '');
    return suffix || 'base';
  }
  const match = cleanCardNo.match(/_([A-Za-z]+\d+)$/);
  return match ? match[1].toLowerCase() : 'base';
}

function seriesName(series = {}) {
  return series.koName || series.name || series.seriesName || series.id;
}

function seriesNameEn(series = {}) {
  return series.enName || series.nameEn || seriesName(series);
}

function seriesKind(series = {}) {
  return {
    ko: series.kindKo || series.categoryKo || '',
    en: series.kindEn || series.category || ''
  };
}

function toSeriesRow(series) {
  const kind = seriesKind(series);
  return {
    id: series.id,
    locale: series.locale || (String(series.id).startsWith('JP-') ? 'JP' : 'KR'),
    base_series_id: series.baseSeriesId || String(series.id).replace(/^(KR|JP)-/, ''),
    name: seriesName(series),
    name_en: seriesNameEn(series),
    kind_ko: kind.ko,
    kind_en: kind.en,
    official_series_keyword: series.officialSeriesKeyword || series.queryLabel || null,
    official_url: series.officialUrl || null,
    description: series.description || null,
    release_order: Number(series.releaseOrder || series.release_order || 0),
    card_count: 0,
    is_active: true
  };
}

function toCardRow(card) {
  const cardNo = String(card.cardNo || '').trim();
  const cardNoBase = card.baseCardNo || baseCardNo(cardNo);
  const locale = card.locale || (String(card.id).startsWith('JP::') ? 'JP' : 'KR');
  const searchText = [cardNo, card.name, card.type, card.effect]
    .map((value) => normalizeSearch(value || ''))
    .filter(Boolean)
    .join(' ');
  return {
    id: card.id,
    locale,
    card_no: cardNo,
    card_no_base: cardNoBase,
    variant_key: variantKey(cardNo, card.id),
    series_id: card.series,
    base_series_id: card.baseSeriesId || String(card.series || '').replace(/^(KR|JP)-/, ''),
    origin_series_id: card.originSeries || card.series,
    origin_base_series_id: card.originBaseSeriesId || String(card.originSeries || card.series || '').replace(/^(KR|JP)-/, ''),
    name: card.name || cardNo,
    name_en: card.nameEn || null,
    name_normalized: normalizeSearch(card.name || cardNo),
    search_text_normalized: searchText,
    rarity: card.rarity || null,
    category: card.category || null,
    category_ko: card.categoryKo || null,
    color: card.color || null,
    color_ko: card.colorKo || null,
    cost: card.cost || null,
    power: card.power || null,
    counter: card.counter || null,
    attribute: card.attribute || null,
    attribute_ko: card.attributeKo || null,
    type: card.type || null,
    effect: card.effect || null,
    image_url: card.imageUrl || null,
    official_url: card.officialUrl || null,
    image_status: card.imageUrl ? 'unknown' : 'missing',
    image_checked_at: null,
    market_code: cardNoBase,
    is_reprint: Boolean(card.isReprint || card.is_reprint || card.originSeries && card.originSeries !== card.series),
    sort_order: Number(card.sortOrder || card.sort_order || 0),
    source_updated_at: null
  };
}

function validate(seriesRows, cardRows) {
  const errors = [];
  const warnings = [];
  const seriesIds = new Set(seriesRows.map((row) => row.id));
  const cardIds = new Set();
  const byLocale = {};
  const imageHosts = {};

  for (const row of cardRows) {
    byLocale[row.locale] = (byLocale[row.locale] || 0) + 1;

    if (cardIds.has(row.id)) errors.push(`duplicate card id: ${row.id}`);
    cardIds.add(row.id);

    if (!row.id.includes('::')) errors.push(`invalid card id format: ${row.id}`);
    if (!seriesIds.has(row.series_id)) errors.push(`missing series for ${row.id}: ${row.series_id}`);
    if (row.origin_series_id && !seriesIds.has(row.origin_series_id)) {
      warnings.push(`missing origin series for ${row.id}: ${row.origin_series_id}`);
    }
    if (!row.card_no_base) errors.push(`missing card_no_base: ${row.id}`);
    if (!row.image_url) warnings.push(`missing image_url: ${row.id}`);

    if (row.image_url) {
      try {
        const host = new URL(row.image_url).hostname;
        imageHosts[host] = (imageHosts[host] || 0) + 1;
      } catch {
        errors.push(`invalid image_url for ${row.id}: ${row.image_url}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    counts: {
      series: seriesRows.length,
      cards: cardRows.length,
      byLocale,
      imageHosts
    },
    errors,
    warnings: warnings.slice(0, 200),
    warningCount: warnings.length
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function main() {
  const [series, cards] = await Promise.all([readJson(seriesPath), readJson(cardsPath)]);
  const seriesRows = series.map(toSeriesRow).filter((row) => row.locale === 'KR' || row.locale === 'JP');
  const allowedSeriesIds = new Set(seriesRows.map((row) => row.id));
  const cardRows = cards
    .map(toCardRow)
    .filter((row) => (row.locale === 'KR' || row.locale === 'JP') && allowedSeriesIds.has(row.series_id));
  const countBySeries = new Map();

  for (const card of cardRows) {
    countBySeries.set(card.series_id, (countBySeries.get(card.series_id) || 0) + 1);
  }
  for (const row of seriesRows) {
    row.card_count = countBySeries.get(row.id) || 0;
  }

  const report = validate(seriesRows, cardRows);

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'card_series.json'), `${JSON.stringify(seriesRows, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outDir, 'cards.json'), `${JSON.stringify(cardRows, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outDir, 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
