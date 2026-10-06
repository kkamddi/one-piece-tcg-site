// Weekly market report generator.
//   node scripts/generateWeeklyMarketReport.mjs --sql [--today YYYY-MM-DD]     print the D1 query for the last full week
//   node scripts/generateWeeklyMarketReport.mjs --input rows.json [--today …]  write src/data/market-reports/<weekEnd>.json, index.json and latest.json
// rows.json is the `wrangler d1 execute --json` output of the --sql query (product aggregates, then daily totals).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildWeeklyMarketReport, getMarketReportSummary, getMarketReportTitle, getReportWeek, kstDateKey, weeklyReportSql } from '../lib/market-report.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = path.join(rootDir, 'src', 'data', 'market-reports');
const args = process.argv.slice(2);
const argValue = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ''; };
const week = getReportWeek(argValue('--today') || kstDateKey());

if (args.includes('--sql')) {
  process.stdout.write(weeklyReportSql(week));
  process.exit(0);
}

const inputPath = argValue('--input');
if (!inputPath) throw new Error('Pass --sql or --input <rows.json>.');
const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const rows = Array.isArray(parsed) ? (parsed[0]?.results ?? parsed) : parsed.results || [];
const dailyRows = Array.isArray(parsed) ? parsed[1]?.results || [] : [];
if (!rows.length) throw new Error('The D1 query returned no rows; refusing to write an empty report.');

const load = async (relative) => (await import(pathToFileURL(path.join(rootDir, relative)).href)).default;
const marketCards = await load('src/data/market-cards.js');
const boxItems = await load('src/data/box-market-items.js');
const { sealedBoxes } = await import(pathToFileURL(path.join(rootDir, 'src', 'box-portfolio.js')).href);
const { getMarketVariantLabel } = await import(pathToFileURL(path.join(rootDir, 'src', 'market-variant-label.js')).href);
const cards = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'cards.json'), 'utf8'));
const marketLinks = await load('src/data/card-market-links.js');
const boxPrices = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'box-market-prices.json'), 'utf8')).items || {};

const krNames = new Map();
for (const card of cards) {
  const code = String(card.cardNo || '').replace(/_p\d+$/i, '');
  if (card.locale === 'KR' && card.name && !krNames.has(code)) krNames.set(code, card.name);
}
// Wano disguise names are the official card names; add the crew member readers know them by.
const DISGUISE_NAMES = { 오나미: '나미', 오로비: '로빈', 상고로: '상디', 쵸파에몬: '쵸파', 우소하치: '우솝', 프라노스케: '프랑키', 본키치: '브룩' };
const withAlias = (name) => (DISGUISE_NAMES[name] ? `${name}(${DISGUISE_NAMES[name]})` : name);
const shortName = (name) => String(name || '')
  .replace(/\s*:?\s*Opened\b/gi, '')
  .replace(/\s*\[[^\]]+\]/g, '')
  .replace(/\s*\([^)]*\)/g, '')
  .replace(/\b(SEC-SPC|SEC-SP|SEC-P|SR-SP|SR-P|R-P|L-P|SP|SEC|L|SR|R|UC|C|P)\b.*$/i, '')
  .replace(/\s{2,}/g, ' ')
  .trim();
// Approved links give the catalog card behind a SNKRDUNK product, which has a cleaner thumbnail.
const linkedCards = new Map(marketLinks.filter((link) => link.status === 'approved').map((link) => [Number(link.apparelId), link]));
const products = new Map();
for (const item of marketCards) {
  // Prize and bundle products carry the printed card number in brackets; prefer it over the SNKRDUNK product code.
  const code = (String(item.name || '').match(/\[((?:OP|EB|ST|PRB|P)\d*-\d{3})\]/i)?.[1] || String(item.code || '')).toUpperCase();
  if (!code || products.has(Number(item.apparelId))) continue;
  const variant = getMarketVariantLabel(item, 'KR');
  const name = withAlias(krNames.get(code) || shortName(item.name) || code);
  products.set(Number(item.apparelId), {
    code,
    label: `${name} ${code}${variant ? ` (${variant})` : ''}`,
    set: /^(OP|EB|ST|PRB)\d+-/.test(code) ? code.split('-')[0] : '프로모·기타',
    imageUrl: item.previewImageUrl || '',
    cardId: linkedCards.get(Number(item.apparelId))?.cardId || '',
    locale: linkedCards.get(Number(item.apparelId))?.locale || item.locale || ''
  });
}

fs.mkdirSync(reportsDir, { recursive: true });
const indexPath = path.join(reportsDir, 'index.json');
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
const previous = index.filter((entry) => entry.id < week.weekEnd).sort((x, y) => y.id.localeCompare(x.id))[0];
const previousReport = previous ? JSON.parse(fs.readFileSync(path.join(reportsDir, `${previous.id}.json`), 'utf8')) : null;
const releaseOf = (box) => boxItems.find((item) => Number(item.apparelId) === Number(box.apparelId))?.releaseDate || '';
const boxes = sealedBoxes
  .filter((box) => releaseOf(box) && releaseOf(box) <= week.weekEnd)
  .sort((x, y) => releaseOf(y).localeCompare(releaseOf(x)))
  .slice(0, 8);

const report = buildWeeklyMarketReport({ week, rows, dailyRows, products, boxes, boxPrices, previousBoxSnapshot: previousReport?.boxSnapshot || null });
const existingPath = path.join(reportsDir, `${report.id}.json`);
// Re-running a week keeps any editor notes written into the earlier file.
if (fs.existsSync(existingPath)) report.notes = JSON.parse(fs.readFileSync(existingPath, 'utf8')).notes || [];
fs.writeFileSync(existingPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const nextIndex = [
  { id: report.id, weekStart: report.weekStart, weekEnd: report.weekEnd, title: getMarketReportTitle(report) },
  ...index.filter((entry) => entry.id !== report.id)
].sort((x, y) => y.id.localeCompare(x.id));
fs.writeFileSync(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`, 'utf8');
if (report.id === nextIndex[0].id) fs.writeFileSync(path.join(reportsDir, 'latest.json'), `${JSON.stringify(getMarketReportSummary(report), null, 2)}\n`, 'utf8');
console.log(`[market-report] ${report.id}: PSA10 ${report.totals.psa10.trades} trades, Single ${report.totals.a.trades} trades, ${report.boxes.length} boxes`);
