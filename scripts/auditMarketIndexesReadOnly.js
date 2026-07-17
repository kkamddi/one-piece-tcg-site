import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { assertEqualWeightedMarketIndex } from '../lib/market-index-audit.js';
import { buildEqualWeightedMarketIndex } from '../lib/market-index-chain.js';
import marketIndexes from '../src/data/market-index-components.js';

const DATABASE_NAME = String(process.env.MARKET_INDEX_D1_DATABASE || 'optcgkorea-public-shadow').trim();
const CONDITION_KEY = 'psa10';
const SUMMARY_ONLY = process.argv.includes('--summary-only')
  || String(process.env.MARKET_INDEX_AUDIT_SUMMARY_ONLY || '').trim() === '1';
const codeArgument = process.argv.find((value) => value.startsWith('--codes='));
const codeFilter = new Set(
  String(codeArgument?.slice('--codes='.length) || process.env.MARKET_INDEX_CODES || 'manga')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

function quoteSqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function findWranglerEntry() {
  const candidates = [path.resolve('node_modules/wrangler/bin/wrangler.js')];
  const cacheRoot = path.join(String(process.env.LOCALAPPDATA || ''), 'npm-cache', '_npx');
  if (cacheRoot && existsSync(cacheRoot)) {
    for (const entry of readdirSync(cacheRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      candidates.push(path.join(cacheRoot, entry.name, 'node_modules', 'wrangler', 'bin', 'wrangler.js'));
    }
  }
  return candidates
    .filter((candidate) => existsSync(candidate))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0] || '';
}

function readD1Rows(apparelIds) {
  if (!apparelIds.length) return [];
  const sql = `select apparel_id, point_date, median_price_jpy, trade_count
    from market_chart_daily_points
    where source = 'snkrdunk'
      and condition_key = ${quoteSqlText(CONDITION_KEY)}
      and apparel_id in (${apparelIds.join(',')})
    order by apparel_id, point_date`;
  const wranglerEntry = findWranglerEntry();
  if (!wranglerEntry) throw new Error('Wrangler executable was not found.');
  const result = spawnSync(process.execPath, [
    wranglerEntry, 'd1', 'execute', DATABASE_NAME,
    '--remote', '--json', '--command', sql
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(String(
      result.error?.message
      || result.stderr
      || result.stdout
      || `wrangler exited ${result.status}`
    ).trim());
  }
  const parsed = JSON.parse(result.stdout);
  const query = Array.isArray(parsed) ? parsed[0] : parsed;
  return Array.isArray(query?.results) ? query.results : [];
}

function formatInitialDays(series) {
  return series.slice(0, 5)
    .map((point) => `${point.date}:${point.price}(${point.tradeCount})`)
    .join(',');
}

const selectedIndexes = marketIndexes.filter((index) => (
  !codeFilter.size || codeFilter.has(String(index.code).toLowerCase())
));
if (!selectedIndexes.length) {
  throw new Error(`No market index matched MARKET_INDEX_CODES=${[...codeFilter].join(',')}`);
}

const apparelIds = [...new Set(selectedIndexes.flatMap((index) => (
  index.components.map((component) => Number(component.apparelId)).filter(Boolean)
)))];
const rows = readD1Rows(apparelIds);

for (const indexConfig of selectedIndexes) {
  const built = buildEqualWeightedMarketIndex(indexConfig, rows);
  assertEqualWeightedMarketIndex(built);
  const latest = built.indexPoints.at(-1);
  const latestComponentPoints = built.componentPoints.filter((point) => point.date === latest?.date);
  const latestComponentAverage = latestComponentPoints.length
    ? latestComponentPoints.reduce((sum, point) => sum + point.componentIndexValue, 0) / latestComponentPoints.length
    : 0;
  console.log(JSON.stringify({
    type: 'index',
    code: indexConfig.code,
    baseDate: built.baseDate,
    latestDate: latest?.date || '',
    latestValue: latest?.value || 0,
    latestComponentAverage: Number(latestComponentAverage.toFixed(4)),
    latestComponentSum: latest?.rawComponentSum || 0,
    configuredComponents: indexConfig.components.length,
    includedComponents: built.dataComponents.length,
    excludedComponents: built.excludedComponents.length,
    exclusions: built.excludedComponents.map((component) => ({
      apparelId: Number(component.apparelId),
      reason: component.reason,
      sourceObservationCount: component.sourceObservationCount
    }))
  }));
  if (SUMMARY_ONLY) continue;

  for (const component of built.dataComponents) {
    const latestPoint = component.series.at(-1) || {};
    console.log(JSON.stringify({
      type: 'component',
      index: indexConfig.code,
      code: component.code,
      name: component.name,
      apparelId: Number(component.apparelId),
      sourceFirstDate: component.sourceFirstObservedDate,
      sourceFirstPrice: component.sourceFirstObservedPrice,
      sourceInitialTradingDays: formatInitialDays(component.sourceSeries),
      acceptedInitialTradingDays: formatInitialDays(component.rawSeries),
      baselineDate: component.firstDate,
      baselinePrice: component.basePrice,
      latestDate: latestPoint.date || '',
      latestPrice: Number(latestPoint.price || 0),
      individualIndex: component.basePrice > 0
        ? Number((100 * Number(latestPoint.price || 0) / component.basePrice).toFixed(2))
        : null,
      ignoredTradingDays: component.ignoredObservationCount
    }));
  }

  for (const component of built.excludedComponents) {
    console.log(JSON.stringify({
      type: 'excluded',
      index: indexConfig.code,
      apparelId: Number(component.apparelId),
      sourceFirstDate: component.sourceFirstObservedDate,
      sourceFirstPrice: component.sourceFirstObservedPrice,
      initialTradingDays: (component.initialTradingDays || [])
        .map((point) => `${point.date}:${point.price}(${point.tradeCount})`)
        .join(','),
      ignoredTradingDays: component.ignoredObservationCount,
      reason: component.reason
    }));
  }
}
