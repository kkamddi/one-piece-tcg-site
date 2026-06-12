# Market D1/R2 Migration Simple Plan

Goal: keep Supabase market history intact, copy public market data to Cloudflare, verify it, then decide later whether Supabase can be cleaned.

## What Goes Where

D1 stores data the app needs quickly:

- product list and current price metadata
- daily chart points for graphs
- recent trades
- latest snapshot summary
- card-to-market links
- collector run summaries

R2 stores large raw backup files:

- `market_price_snapshots.raw_payload`
- `market_chart_snapshots.raw_chart`
- optional raw collector run output

Supabase remains the original source until D1/R2 is verified.

## Files Added

- `migrations/d1/0002_market_history_shadow.sql`
- `scripts/marketD1R2DryRun.js`

## Dry-run Command

This only counts and samples Supabase data. It does not modify data.

```powershell
$env:SUPABASE_URL="..."
$env:SUPABASE_SERVICE_ROLE_KEY="..."
node scripts\marketD1R2DryRun.js
```

Output:

- `data/d1-market-migration/dry-run-report.json`

## Current Dry-run Result

Generated on the current Supabase market tables:

- `market_products`: 3,127 rows
- `market_collection_runs`: 173 rows
- `market_price_snapshots`: 52,454 rows
- `market_chart_points`: 89,999 rows
- `market_recent_trades`: 10,725 rows
- `market_chart_snapshots`: 2,242 rows

Retention-window reference counts:

- `market_price_snapshots` recent 14d: 52,454 rows
- `market_chart_points` recent 90d: 36,967 rows
- `market_recent_trades` recent 30d: 10,725 rows
- `market_chart_snapshots` recent 14d: 2,242 rows

This confirms the main large transfer target is still chart/price market history. Nothing was deleted or updated.

## Current Cloudflare Status

D1 shadow DB is prepared and schema additions were applied:

- `optcgkorea-public-shadow`
- Added market migration helper tables through `migrations/d1/0002_market_history_shadow.sql`

R2 is not enabled on the Cloudflare account yet. Wrangler returned:

```txt
Please enable R2 through the Cloudflare Dashboard. [code: 10042]
```

R2 raw payload backup cannot proceed until R2 is enabled in the Cloudflare dashboard.

## D1-only Market History Copy Result

R2 was skipped. The current pass copied only app-facing market data into the D1 shadow DB.

Generated seed files:

- `data/d1-market-history-seed/101_market_price_latest_snapshots.sql`
- `data/d1-market-history-seed/102_market_chart_daily_points.sql`
- `data/d1-market-history-seed/103_market_recent_trades.sql`
- `data/d1-market-history-seed/104_market_collection_runs.sql`

Source rows read from Supabase, read-only:

- `market_price_snapshots`: 52,454
- `market_chart_points`: 89,999
- `market_recent_trades`: 10,725
- `market_collection_runs`: 173

D1 rows generated/imported:

- `market_price_latest_snapshots`: 3,049
- `market_chart_daily_points`: 89,964
- `market_recent_trades`: 10,725
- `market_collection_runs`: 173

Representative D1 verification:

- `ST21-014 / apparel_id 706813`
  - chart daily points: 682
  - recent trades: 6
- `OP05-119 / apparel_id 135437`
  - latest snapshot row exists
- `P-046 / apparel_id 136542`
  - latest snapshot row exists

Shadow DB size after public data + market history copy: about 42.12 MB.

Production app reads were not switched to D1. Collector writes were not changed. Supabase rows were not deleted or updated.

## D1 vs Supabase Read-only Verification

Verification command:

```powershell
node scripts\verifyD1MarketAgainstSupabase.js
```

Output:

- `data/d1-market-migration/d1-vs-supabase-market-verify.json`

Result:

- D1 `market_price_latest_snapshots`: 3,049 rows
- D1 `market_chart_daily_points`: 89,964 rows
- D1 `market_recent_trades`: 10,725 rows
- D1 `market_collection_runs`: 173 rows
- Supabase `market_price_snapshots`: 52,454 source rows
- Supabase `market_chart_points`: 89,999 source rows
- Supabase `market_recent_trades`: 10,725 source rows
- Supabase `market_collection_runs`: 173 source rows

Sample checks:

- `OP05-119 / apparel_id 135437`
  - D1 latest row matches source code.
  - D1 chart points: 195.
  - D1 recent trades: 6.
- `P-046 / apparel_id 136542`
  - D1 latest row matches source code.
  - D1 chart points: 177.
  - D1 recent trades: 6.
- `ST21-014 / apparel_id 706813`
  - D1 latest row matches source code and captured timestamp.
  - D1 chart daily points: 682.
  - Source raw points: 684.
  - Difference is expected because D1 stores daily median-compressed points.
  - D1 recent trades: 6.

No production app reads were switched to D1 during this verification. No Supabase rows were deleted, updated, or vacuumed.

## D1 Schema Additions

`0002_market_history_shadow.sql` adds:

- `market_price_latest_snapshots`
- `market_collection_runs`
- `market_raw_payload_index`

Existing shadow tables already cover:

- `market_products`
- `market_chart_daily_points`
- `market_recent_trades`
- `card_market_links`

## R2 Key Rules

Suggested keys:

```txt
market/raw-price/source=snkrdunk/year=YYYY/month=MM/day=DD/apparelId=ID/capturedAt=ISO.json.gz
market/raw-chart/source=snkrdunk/year=YYYY/month=MM/day=DD/apparelId=ID/condition=KEY/capturedAt=ISO.json.gz
market/runs/source=snkrdunk/year=YYYY/month=MM/day=DD/runId=ID/summary.json.gz
```

The D1 table `market_raw_payload_index` stores the R2 key, payload type, product id, timestamp, size, and hash.

## Safe Execution Order

1. Apply D1 schema additions to the shadow DB.
2. Run dry-run counts against Supabase.
3. Export 10-20 sample products only.
4. Upload sample raw payloads to R2.
5. Import sample summary rows and daily points to D1.
6. Verify D1/R2 counts and sample cards.
7. Only after sample verification, run full export/import.
8. Only after full verification, consider app D1-first reads.
9. Only after production D1 reads are stable, consider Supabase cleanup.

## Do Not Do Yet

- Do not delete Supabase rows.
- Do not null raw payload columns.
- Do not vacuum Supabase.
- Do not switch production reads to D1.
- Do not switch collector writes to D1.
