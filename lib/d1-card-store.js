const D1_BINDING_NAME = String(process.env.PUBLIC_D1_BINDING || 'OPTCG_PUBLIC_D1').trim();

function getD1Binding() {
  const binding = process.env?.[D1_BINDING_NAME] || process.env?.DB || null;
  return binding && typeof binding.prepare === 'function' ? binding : null;
}

function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.\u30fb\u00b7]/g, '')
    .trim();
}

async function queryD1(sql, params = []) {
  const binding = getD1Binding();
  if (!binding) return null;
  const statement = binding.prepare(sql);
  const result = params.length ? await statement.bind(...params).all() : await statement.all();
  return result?.results || [];
}

function toLegacySeries(row = {}) {
  return {
    id: row.id,
    locale: row.locale,
    baseSeriesId: row.base_series_id,
    koName: row.name,
    enName: row.name_en || row.name,
    kindKo: row.kind_ko || '',
    kindEn: row.kind_en || '',
    queryLabel: row.official_series_keyword || row.name,
    officialUrl: row.official_url || '',
    description: row.description || '',
    releaseOrder: row.release_order || 0
  };
}

function toLegacyCard(row = {}, seriesMap = new Map()) {
  const series = seriesMap.get(row.series_id);
  return {
    id: row.id,
    locale: row.locale,
    cardNo: row.card_no,
    baseCardNo: row.card_no_base,
    variantKey: row.variant_key || '',
    series: row.series_id,
    baseSeriesId: row.base_series_id,
    originSeries: row.origin_series_id || row.series_id,
    originBaseSeriesId: row.origin_base_series_id || row.base_series_id,
    name: row.name,
    nameEn: row.name_en || '',
    rarity: row.rarity || '',
    category: row.category || '',
    categoryKo: row.category_ko || '',
    color: row.color || '',
    colorKo: row.color_ko || '',
    cost: row.cost || '',
    power: row.power || '',
    counter: row.counter || '',
    attribute: row.attribute || '',
    attributeKo: row.attribute_ko || '',
    type: row.type || '',
    effect: row.effect || '',
    imageUrl: row.image_url || '',
    officialUrl: row.official_url || '',
    marketCode: row.market_code || row.card_no,
    seriesName: series?.koName || row.series_id,
    seriesNameEn: series?.enName || row.series_id,
    isReprint: Boolean(row.is_reprint)
  };
}

async function readSeriesRows() {
  return queryD1(`
    SELECT *
    FROM card_series
    WHERE locale IN ('KR', 'JP') AND is_active = 1
    ORDER BY locale ASC, release_order ASC, id ASC
  `);
}

async function readSeriesMap() {
  const rows = await readSeriesRows();
  if (!rows) return null;
  return new Map(rows.map((row) => [row.id, toLegacySeries(row)]));
}

export async function readD1Series() {
  const rows = await readSeriesRows();
  return rows ? rows.map(toLegacySeries) : null;
}

export async function readD1Cards(filters = {}) {
  const seriesMap = await readSeriesMap();
  if (!seriesMap) return null;

  const where = [];
  const params = [];
  if (filters.locale) {
    where.push('locale = ?');
    params.push(filters.locale);
  }
  if (filters.series) {
    where.push('series_id = ?');
    params.push(filters.series);
  }
  if (filters.rarity) {
    where.push('rarity = ?');
    params.push(filters.rarity);
  }
  if (filters.q) {
    where.push('search_text_normalized LIKE ?');
    params.push(`%${normalizeSearch(filters.q)}%`);
  }

  const requestedLimit = Number(filters.limit);
  const requestedPage = Number(filters.page);
  const requestedOffset = Number(filters.offset);
  const hasLimit = Number.isFinite(requestedLimit) && requestedLimit > 0;
  const safeLimit = hasLimit ? Math.min(Math.floor(requestedLimit), 500) : 0;
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const safeOffset = Number.isFinite(requestedOffset) && requestedOffset >= 0
    ? Math.floor(requestedOffset)
    : (safePage - 1) * safeLimit;
  const pageSize = safeLimit || 1000;
  const rows = [];

  for (let offset = safeLimit ? safeOffset : 0; ; offset += pageSize) {
    const pageRows = await queryD1(`
      SELECT *
      FROM cards
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY locale ASC, series_id ASC, sort_order ASC, card_no ASC, id ASC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);
    if (!pageRows) return null;
    rows.push(...pageRows);
    if (safeLimit || pageRows.length < pageSize) break;
  }

  return rows.map((row) => toLegacyCard(row, seriesMap));
}

export async function readD1CardById(id) {
  if (!id) return null;
  const seriesMap = await readSeriesMap();
  if (!seriesMap) return null;
  const rows = await queryD1('SELECT * FROM cards WHERE id = ? LIMIT 1', [id]);
  if (!rows) return null;
  return rows[0] ? toLegacyCard(rows[0], seriesMap) : null;
}
