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
const samplePath = path.join(rootDir, 'tmp', 'psa10-p046-yamato-sample.json');
const inputPath = args.has('input') ? path.resolve(rootDir, args.get('input')) : samplePath;
const outDir = path.join(rootDir, 'data', 'd1-psa10-seed');
const outPath = path.join(outDir, '001_psa10_p046_yamato.sql');
const nowIso = new Date().toISOString();
const USD_TO_KRW = 1360;

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insertSql(table, columns, rows) {
  if (!rows.length) return '';
  const values = rows
    .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(', ')})`)
    .join(',\n');
  return `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES\n${values};\n`;
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function normalizeCollectedPayload(payload) {
  if (Array.isArray(payload) && payload[0]?.sales) {
    const item = payload[0];
    const sales = item.sales || [];
    const byDate = new Map();
    for (const sale of sales) {
      if (!sale.soldAt || !Number(sale.priceUsd)) continue;
      const list = byDate.get(sale.soldAt) || [];
      list.push(sale);
      byDate.set(sale.soldAt, list);
    }
    return {
      card: {
        cardId: item.cardId,
        cardNo: item.cardNo,
        locale: item.locale,
        name: item.name || 'Yamato',
        grade: 'PSA10',
        matchBasis: ['psa_spec_url', item.specUrl]
      },
      recentTrades: sales.map((sale) => ({
        soldAt: sale.soldAt,
        priceUsd: sale.priceUsd,
        source: sale.source || 'psa_sales_history_api',
        platform: sale.platform || 'eBay',
        title: sale.title || '',
        rawTitle: sale.rawText || '',
        sourceUrl: sale.sourceUrl || '',
        lotNumber: sale.saleItemId || sale.certNumber || `${sale.soldAt}-${sale.priceUsd}`,
        confidence: 92,
        status: 'approved'
      })),
      chart: {
        points: [...byDate.entries()]
          .sort(([a], [b]) => String(a).localeCompare(String(b)))
          .map(([date, dateSales]) => {
            const prices = dateSales.map((sale) => Number(sale.priceUsd)).filter(Boolean);
            return {
              date,
              medianUsd: median(prices),
              minUsd: Math.min(...prices),
              maxUsd: Math.max(...prices),
              tradeCount: prices.length,
              sources: [...new Set(dateSales.map((sale) => sale.platform || 'eBay'))]
            };
          })
      }
    };
  }
  return payload;
}

const sample = normalizeCollectedPayload(JSON.parse(await readFile(inputPath, 'utf8')));
const linkRow = {
  card_id: sample.card.cardId,
  card_no: sample.card.cardNo,
  locale: sample.card.locale,
  name: sample.card.name,
  grade: sample.card.grade,
  search_query: '2023 One Piece Japanese Promos Yamato #046 One Piece Magazine Vol.17 PSA 10',
  match_basis_json: JSON.stringify(sample.card.matchBasis || []),
  status: 'approved',
  confidence: 96,
  notes: 'P-046 Yamato Japanese Promo / One Piece Magazine Vol.17 PSA10 sample import',
  created_at: nowIso,
  updated_at: nowIso
};

const tradeRows = sample.recentTrades.map((trade) => ({
  id: `psa:${sample.card.cardId}:${trade.lotNumber || trade.soldAt}`,
  card_id: sample.card.cardId,
  card_no: sample.card.cardNo,
  locale: sample.card.locale,
  grade: sample.card.grade,
  source: trade.source || 'psa',
  platform: trade.platform || 'PSA',
  sold_at: trade.soldAt,
  price_usd: Number(trade.priceUsd),
  price_krw: Math.round(Number(trade.priceUsd) * USD_TO_KRW),
  title: trade.title,
  raw_title: trade.rawTitle,
  source_url: trade.sourceUrl,
  lot_number: trade.lotNumber,
  confidence: trade.confidence || 0,
  status: trade.status || 'pending',
  created_at: nowIso,
  updated_at: nowIso
}));

const pointRows = sample.chart.points.map((point) => ({
  card_id: sample.card.cardId,
  point_date: point.date,
  grade: sample.card.grade,
  source: 'integrated',
  median_usd: Number(point.medianUsd),
  min_usd: Number(point.minUsd),
  max_usd: Number(point.maxUsd),
  trade_count: Number(point.tradeCount),
  sources_json: JSON.stringify(point.sources || []),
  updated_at: nowIso
}));

const sql = [
  'PRAGMA foreign_keys = ON;',
  insertSql('psa10_market_links', [
    'card_id', 'card_no', 'locale', 'name', 'grade', 'search_query', 'match_basis_json',
    'status', 'confidence', 'notes', 'created_at', 'updated_at'
  ], [linkRow]),
  insertSql('psa10_market_trades', [
    'id', 'card_id', 'card_no', 'locale', 'grade', 'source', 'platform', 'sold_at',
    'price_usd', 'price_krw', 'title', 'raw_title', 'source_url', 'lot_number',
    'confidence', 'status', 'created_at', 'updated_at'
  ], tradeRows),
  insertSql('psa10_market_daily_points', [
    'card_id', 'point_date', 'grade', 'source', 'median_usd', 'min_usd', 'max_usd',
    'trade_count', 'sources_json', 'updated_at'
  ], pointRows)
].filter(Boolean).join('\n\n');

await mkdir(outDir, { recursive: true });
await writeFile(outPath, `${sql}\n`, 'utf8');

console.log(JSON.stringify({
  output: outPath,
  linkRows: 1,
  tradeRows: tradeRows.length,
  dailyPointRows: pointRows.length
}, null, 2));
