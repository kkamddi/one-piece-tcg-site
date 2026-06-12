import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'data/d1-market-migration');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'ed82677cb22fd8679792f6cff73a00d6';
const D1_DATABASE_ID = process.env.D1_DATABASE_ID || 'da59fbad-d4bb-4f4a-88cc-37b0a698646a';

const sampleApparelIds = (process.env.SAMPLE_APPAREL_IDS || '135437,136542,706813')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter(Boolean);

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing env: ${name}`);
}

requireEnv('SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);
requireEnv('CLOUDFLARE_API_TOKEN', CLOUDFLARE_API_TOKEN);

async function supabaseRows(table, select, filterQuery = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filterQuery}`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${table} failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function supabaseCount(table, filterQuery = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=0${filterQuery}`;
  const response = await fetch(url, {
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
  const countText = (response.headers.get('content-range') || '').split('/')[1];
  return Number(countText || 0);
}

async function d1Query(sql, params = []) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(`D1 query failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body.result?.[0]?.results || [];
}

async function compareOne(apparelId) {
  const supabaseLatest = await supabaseRows(
    'market_price_snapshots',
    'source,apparel_id,locale,code,captured_at,min_price_amount,min_price_currency,listing_count',
    `&apparel_id=eq.${apparelId}&order=captured_at.desc&limit=1`
  );
  const d1Latest = await d1Query(
    'select source, apparel_id, locale, code, captured_at, min_price_amount, min_price_currency, listing_count from market_price_latest_snapshots where apparel_id = ? limit 1',
    [apparelId]
  );

  const supabaseChartCount = await supabaseCount('market_chart_points', `&apparel_id=eq.${apparelId}`);
  const d1ChartCount = await d1Query(
    'select count(*) as count from market_chart_daily_points where apparel_id = ?',
    [apparelId]
  );
  const d1ChartRange = await d1Query(
    'select min(point_date) as min_date, max(point_date) as max_date from market_chart_daily_points where apparel_id = ?',
    [apparelId]
  );

  const supabaseTradeCount = await supabaseCount('market_recent_trades', `&apparel_id=eq.${apparelId}`);
  const d1TradeCount = await d1Query(
    'select count(*) as count from market_recent_trades where apparel_id = ?',
    [apparelId]
  );

  return {
    apparelId,
    latest: {
      supabase: supabaseLatest[0] || null,
      d1: d1Latest[0] || null,
      codeMatches: Boolean(supabaseLatest[0] && d1Latest[0] && supabaseLatest[0].code === d1Latest[0].code)
    },
    chart: {
      supabaseRawPoints: supabaseChartCount,
      d1DailyPoints: d1ChartCount[0]?.count || 0,
      d1Range: d1ChartRange[0] || null
    },
    trades: {
      supabaseRows: supabaseTradeCount,
      d1Rows: d1TradeCount[0]?.count || 0
    }
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const tableCounts = {
    d1: {
      market_price_latest_snapshots: (await d1Query('select count(*) as count from market_price_latest_snapshots'))[0]?.count || 0,
      market_chart_daily_points: (await d1Query('select count(*) as count from market_chart_daily_points'))[0]?.count || 0,
      market_recent_trades: (await d1Query('select count(*) as count from market_recent_trades'))[0]?.count || 0,
      market_collection_runs: (await d1Query('select count(*) as count from market_collection_runs'))[0]?.count || 0
    },
    supabase: {
      market_price_snapshots: await supabaseCount('market_price_snapshots'),
      market_chart_points: await supabaseCount('market_chart_points'),
      market_recent_trades: await supabaseCount('market_recent_trades'),
      market_collection_runs: await supabaseCount('market_collection_runs')
    }
  };

  const samples = [];
  for (const apparelId of sampleApparelIds) {
    samples.push(await compareOne(apparelId));
  }

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: 'read-only compare; no app switch, no collector change, no Supabase mutation',
    tableCounts,
    samples
  };

  await writeFile(path.join(outDir, 'd1-vs-supabase-market-verify.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
