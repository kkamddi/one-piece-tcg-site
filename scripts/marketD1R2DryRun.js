import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'data/d1-market-migration');

function readEnv(name) {
  return process.env[name] || '';
}

function requireEnv(name) {
  const value = readEnv(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

async function restCount(table, filters = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=0${filters}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'count=exact'
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${table} count failed: ${response.status} ${text}`);
  }
  const range = response.headers.get('content-range') || '';
  const countText = range.split('/')[1];
  return Number(countText || 0);
}

async function sampleRows(table, select, limit = 3) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${limit}`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${table} sample failed: ${response.status} ${text}`);
  }
  return response.json();
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function main() {
  const thresholds = {
    priceSnapshotsRecent: daysAgoIso(14),
    chartPointsRecent: daysAgoIso(90),
    recentTradesRecent: daysAgoIso(30),
    chartSnapshotsRecent: daysAgoIso(14)
  };

  const counts = {
    market_products: {
      total: await restCount('market_products')
    },
    market_collection_runs: {
      total: await restCount('market_collection_runs')
    },
    market_price_snapshots: {
      total: await restCount('market_price_snapshots'),
      recent14d: await restCount('market_price_snapshots', `&captured_at=gte.${encodeURIComponent(thresholds.priceSnapshotsRecent)}`)
    },
    market_chart_points: {
      total: await restCount('market_chart_points'),
      recent90d: await restCount('market_chart_points', `&point_date=gte.${encodeURIComponent(thresholds.chartPointsRecent)}`)
    },
    market_recent_trades: {
      total: await restCount('market_recent_trades'),
      recent30d: await restCount('market_recent_trades', `&last_seen_at=gte.${encodeURIComponent(thresholds.recentTradesRecent)}`)
    },
    market_chart_snapshots: {
      total: await restCount('market_chart_snapshots'),
      recent14d: await restCount('market_chart_snapshots', `&captured_at=gte.${encodeURIComponent(thresholds.chartSnapshotsRecent)}`)
    }
  };

  const samples = {
    market_products: await sampleRows('market_products', 'source,apparel_id,locale,code,name,latest_captured_at', 3),
    market_price_snapshots: await sampleRows('market_price_snapshots', 'source,apparel_id,locale,code,captured_at,min_price_amount,listing_count', 3),
    market_chart_points: await sampleRows('market_chart_points', 'source,apparel_id,locale,code,condition_key,point_date,price_amount', 3),
    market_recent_trades: await sampleRows('market_recent_trades', 'source,apparel_id,locale,code,condition,trade_date_text,price_amount,last_seen_at', 3),
    market_chart_snapshots: await sampleRows('market_chart_snapshots', 'source,apparel_id,locale,code,captured_at,chart_type', 3)
  };

  const plan = {
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: 'dry-run only; no delete, update, vacuum, D1 import, or R2 upload',
    thresholds,
    counts,
    samples,
    nextStep: 'Use these counts to size D1 daily points and R2 raw payload export batches.'
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'dry-run-report.json'), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    report: 'data/d1-market-migration/dry-run-report.json',
    counts
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
