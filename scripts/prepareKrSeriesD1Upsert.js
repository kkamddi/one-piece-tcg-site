import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'src/data');
const targetSeriesId = String(process.argv.find((arg) => arg.startsWith('--series=')) || '').slice('--series='.length).trim();

if (!/^KR-[A-Z0-9]+$/.test(targetSeriesId)) {
  throw new Error('Usage: node scripts/prepareKrSeriesD1Upsert.js --series=KR-EB03');
}

const outputPath = path.join(rootDir, 'data/d1-public-seed', `${targetSeriesId.toLowerCase()}-upsert.sql`);
const nowIso = new Date().toISOString();

function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.\u30fb\u00b7]/g, '')
    .trim();
}

function baseCardNo(cardNo = '') {
  return String(cardNo).trim().replace(/_[pr]\d+$/i, '').replace(/_P\d+$/i, '');
}

function variantKey(cardNo = '', id = '') {
  const cleanId = String(id).split('::')[1] || '';
  const cleanCardNo = String(cardNo).trim();
  if (cleanId && cleanId !== cleanCardNo) {
    return cleanId.replace(cleanCardNo, '').replace(/^[_-]/, '') || 'base';
  }
  return cleanCardNo.match(/_([A-Za-z]+\d+)$/)?.[1].toLowerCase() || 'base';
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function upsertSql(table, columns, rows, batchSize = 25) {
  const updateColumns = columns.filter((column) => column !== 'id' && column !== 'created_at');
  const statements = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    const values = rows.slice(index, index + batchSize)
      .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(', ')})`)
      .join(',\n');
    statements.push(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values}\n`
      + `ON CONFLICT(id) DO UPDATE SET ${updateColumns.map((column) => `${column}=excluded.${column}`).join(', ')};`
    );
  }
  return `${statements.join('\n\n')}\n`;
}

function toSeriesRow(series, cardCount) {
  return {
    id: series.id,
    locale: series.locale || 'KR',
    base_series_id: series.baseSeriesId || series.id.replace(/^KR-/, ''),
    name: series.koName || series.name || series.id,
    name_en: series.enName || series.koName || series.id,
    kind_ko: series.kindKo || null,
    kind_en: series.kindEn || null,
    official_series_keyword: series.officialSeriesKeyword || series.queryLabel || null,
    official_url: series.officialUrl || null,
    description: series.description || null,
    release_order: Number(series.releaseOrder || 0),
    card_count: cardCount,
    is_active: 1,
    created_at: nowIso,
    updated_at: nowIso
  };
}

function toCardRow(card) {
  const cardNo = String(card.cardNo || '').trim();
  const cardNoBase = card.baseCardNo || baseCardNo(cardNo);
  return {
    id: card.id,
    locale: card.locale || 'KR',
    card_no: cardNo,
    card_no_base: cardNoBase,
    variant_key: variantKey(cardNo, card.id),
    series_id: card.series,
    base_series_id: card.baseSeriesId || card.series.replace(/^KR-/, ''),
    origin_series_id: card.originSeries || card.series,
    origin_base_series_id: card.originBaseSeriesId || String(card.originSeries || card.series).replace(/^KR-/, ''),
    name: card.name || cardNo,
    name_en: card.nameEn || null,
    name_normalized: normalizeSearch(card.name || cardNo),
    search_text_normalized: [cardNo, card.name, card.nameEn, card.type, card.effect]
      .map((value) => normalizeSearch(value || ''))
      .filter(Boolean)
      .join(' '),
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
    is_reprint: Number(Boolean(card.isReprint || card.is_reprint || (card.originSeries && card.originSeries !== card.series))),
    sort_order: Number(card.sortOrder || card.sort_order || 0),
    source_updated_at: null,
    created_at: nowIso,
    updated_at: nowIso
  };
}

const [seriesList, cards] = await Promise.all([
  JSON.parse(await readFile(path.join(dataDir, 'series.json'), 'utf8')),
  JSON.parse(await readFile(path.join(dataDir, 'cards.json'), 'utf8'))
]);
const series = seriesList.find((item) => item.id === targetSeriesId);
const targetCards = cards.filter((card) => card.series === targetSeriesId && card.locale === 'KR');
if (!series || !targetCards.length) {
  throw new Error(`No source data found for ${targetSeriesId}`);
}

const seriesColumns = ['id', 'locale', 'base_series_id', 'name', 'name_en', 'kind_ko', 'kind_en', 'official_series_keyword', 'official_url', 'description', 'release_order', 'card_count', 'is_active', 'created_at', 'updated_at'];
const cardColumns = ['id', 'locale', 'card_no', 'card_no_base', 'variant_key', 'series_id', 'base_series_id', 'origin_series_id', 'origin_base_series_id', 'name', 'name_en', 'name_normalized', 'search_text_normalized', 'rarity', 'category', 'category_ko', 'color', 'color_ko', 'cost', 'power', 'counter', 'attribute', 'attribute_ko', 'type', 'effect', 'image_url', 'official_url', 'image_status', 'image_checked_at', 'market_code', 'is_reprint', 'sort_order', 'source_updated_at', 'created_at', 'updated_at'];
const sql = [
  'PRAGMA foreign_keys = ON;',
  upsertSql('card_series', seriesColumns, [toSeriesRow(series, targetCards.length)]),
  upsertSql('cards', cardColumns, targetCards.map(toCardRow))
].join('\n');

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, sql, 'utf8');
console.log(JSON.stringify({ targetSeriesId, cards: targetCards.length, outputPath }, null, 2));
