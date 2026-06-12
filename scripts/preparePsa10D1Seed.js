import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.length ? rest.join('=') : 'true'];
  })
);
const inputPath = path.resolve(rootDir, args.get('input') || 'tmp/psa10-op-pr-ready5.json');
const outDir = path.resolve(rootDir, args.get('out-dir') || 'data/d1-psa10-seed');
const outPath = path.join(outDir, args.get('out') || '002_psa10_op_pr_ready.sql');
const nowIso = new Date().toISOString();
const USD_TO_KRW = 1360;

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insertSql(table, columns, rows, chunkSize = 40) {
  if (!rows.length) return '';
  const statements = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const values = rows
      .slice(i, i + chunkSize)
      .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(', ')})`)
      .join(',\n');
    statements.push(`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES\n${values};`);
  }
  return `${statements.join('\n')}\n`;
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function makeTradeId(cardId, sale) {
  const sourceId = sale.saleItemId || sale.lotNumber || sale.certNumber || `${sale.soldAt}-${sale.priceUsd}`;
  return `psa:${cardId}:${sourceId}`;
}

const collected = JSON.parse(await readFile(inputPath, 'utf8')).filter((item) => item.ok && Array.isArray(item.sales) && item.sales.length);
const linkRows = [];
const tradeRows = [];
const pointRows = [];

for (const item of collected) {
  const specUrl = item.specUrl || item.url || '';
  const sales = item.sales.filter((sale) => sale.soldAt && Number(sale.priceUsd) > 0);
  if (!sales.length) continue;

  linkRows.push({
    card_id: item.cardId,
    card_no: item.cardNo,
    locale: item.locale || 'JP',
    name: item.name || '',
    grade: 'PSA10',
    search_query: `PSA 10 One Piece Card Game Japanese ${item.cardNo} ${item.name || ''}`.trim(),
    match_basis_json: JSON.stringify(['psa_spec_url', specUrl]),
    status: 'approved',
    confidence: 96,
    notes: `PSA10 spec import: ${specUrl}`,
    created_at: nowIso,
    updated_at: nowIso,
  });

  for (const sale of sales) {
    tradeRows.push({
      id: makeTradeId(item.cardId, sale),
      card_id: item.cardId,
      card_no: item.cardNo,
      locale: item.locale || 'JP',
      grade: 'PSA10',
      source: sale.source || 'psa_sales_history_api',
      platform: sale.platform || 'eBay',
      sold_at: sale.soldAt,
      price_usd: Number(sale.priceUsd),
      price_krw: Math.round(Number(sale.priceUsd) * USD_TO_KRW),
      title: sale.title || '',
      raw_title: sale.rawText || '',
      source_url: sale.sourceUrl || '',
      lot_number: sale.saleItemId || sale.certNumber || '',
      confidence: 92,
      status: 'approved',
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  const byDate = new Map();
  for (const sale of sales) {
    const list = byDate.get(sale.soldAt) || [];
    list.push(sale);
    byDate.set(sale.soldAt, list);
  }
  for (const [date, dateSales] of [...byDate.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)))) {
    const prices = dateSales.map((sale) => Number(sale.priceUsd)).filter((value) => Number.isFinite(value) && value > 0);
    if (!prices.length) continue;
    pointRows.push({
      card_id: item.cardId,
      point_date: date,
      grade: 'PSA10',
      source: 'integrated',
      median_usd: median(prices),
      min_usd: Math.min(...prices),
      max_usd: Math.max(...prices),
      trade_count: prices.length,
      sources_json: JSON.stringify([...new Set(dateSales.map((sale) => sale.platform || 'eBay'))]),
      updated_at: nowIso,
    });
  }
}

const sql = [
  'PRAGMA foreign_keys = ON;',
  insertSql('psa10_market_links', [
    'card_id', 'card_no', 'locale', 'name', 'grade', 'search_query', 'match_basis_json',
    'status', 'confidence', 'notes', 'created_at', 'updated_at',
  ], linkRows),
  insertSql('psa10_market_trades', [
    'id', 'card_id', 'card_no', 'locale', 'grade', 'source', 'platform', 'sold_at',
    'price_usd', 'price_krw', 'title', 'raw_title', 'source_url', 'lot_number',
    'confidence', 'status', 'created_at', 'updated_at',
  ], tradeRows),
  insertSql('psa10_market_daily_points', [
    'card_id', 'point_date', 'grade', 'source', 'median_usd', 'min_usd', 'max_usd',
    'trade_count', 'sources_json', 'updated_at',
  ], pointRows),
].filter(Boolean).join('\n\n');

await mkdir(outDir, { recursive: true });
await writeFile(outPath, `${sql}\n`, 'utf8');
console.log(JSON.stringify({
  output: path.relative(rootDir, outPath).replace(/\\/g, '/'),
  links: linkRows.length,
  trades: tradeRows.length,
  dailyPoints: pointRows.length,
}, null, 2));
