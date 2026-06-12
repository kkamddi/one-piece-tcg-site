import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'data/d1-public-seed');

const sql = `-- Draft only. Run this against Supabase/Postgres to export compressed daily chart points.
-- It does not mutate Supabase data.

WITH normalized AS (
  SELECT
    source,
    apparel_id,
    COALESCE(locale, 'JP') AS locale,
    code,
    condition_key,
    point_date::date AS point_day,
    price_amount::numeric AS price
  FROM market_chart_points
  WHERE price_amount > 0
),
daily AS (
  SELECT
    source,
    apparel_id,
    locale,
    code,
    condition_key,
    point_day,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
    MIN(price) AS min_price,
    MAX(price) AS max_price,
    COUNT(*) AS trade_count
  FROM normalized
  GROUP BY source, apparel_id, locale, code, condition_key, point_day
)
SELECT
  source,
  apparel_id,
  locale,
  code,
  condition_key,
  point_day AS point_date,
  ROUND(median_price)::integer AS median_price_jpy,
  ROUND(min_price)::integer AS min_price_jpy,
  ROUND(max_price)::integer AS max_price_jpy,
  trade_count,
  trade_count AS source_count,
  NOW() AS updated_at
FROM daily
ORDER BY source, apparel_id, condition_key, point_day;
`;

const latestSql = `-- Draft only. Latest product price extraction from Supabase/Postgres.

SELECT DISTINCT ON (source, apparel_id)
  source,
  apparel_id,
  locale,
  code,
  page_title,
  min_price_amount,
  min_price_currency,
  min_price_text,
  listing_count,
  captured_at,
  raw_payload
FROM market_price_snapshots
WHERE ok = TRUE
ORDER BY source, apparel_id, captured_at DESC;
`;

async function main() {
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'draft_market_chart_daily_points_export.sql'), sql, 'utf8');
  await writeFile(path.join(outDir, 'draft_market_latest_price_export.sql'), latestSql, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    files: [
      'data/d1-public-seed/draft_market_chart_daily_points_export.sql',
      'data/d1-public-seed/draft_market_latest_price_export.sql'
    ]
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
