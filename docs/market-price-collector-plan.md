# Market Price Collector Plan

## Current decision

- Store SNKRDUNK collection results as source data first.
- Run the collector every 12 hours after the initial import is verified.
- Do not write directly to user collection tables.
- Do not use pending card mappings for direct card-to-market navigation.

## Initial import status

- Applied storage schema to Supabase.
- Imported one verified source snapshot.
- Current imported counts:
  - products: 2,473
  - price snapshots: 2,473
  - recent trades: 10,685
  - chart snapshots: 1,387
- The failed retry run was marked as failed and its duplicate snapshots were removed.

## Storage flow

1. `market_collection_runs`
   - One row per collection run.
   - Stores run status, counts, and schedule interval.

2. `market_products`
   - One row per SNKRDUNK product/apparelId.
   - Stores the latest product metadata and latest observed min price.

3. `market_price_snapshots`
   - One row per product per run.
   - Stores raw page payload, min price, listing count, and whether history/chart existed.

4. `market_recent_trades`
   - Deduped visible trading history rows.
   - Unique by source, apparelId, trade date text, condition, amount, and currency.

5. `market_chart_snapshots`
   - Stores the visible chart SVG path and axis labels from each run.
   - This is source evidence, not a fully normalized time-series yet.

## 12-hour collection sequence

1. Collect product pages.
2. Save local JSON.
3. Import JSON into Supabase with `scripts/importSnkrdunkVisibleHistoryToSupabase.js`.
4. Keep existing site fallback behavior if a product has no DB history.
5. Report rows inserted, rows skipped, and collector errors.

## Before enabling automation

1. Apply `docs/market-price-storage.sql` in Supabase.
2. Run one import against the collected JSON.
3. Verify table counts.
4. Add frontend/API reads from Supabase price tables.
5. Only then schedule the 12-hour collector.

## Notes

- `Box/Packs Containing This Card` rows should be reviewed before showing as product titles.
- Products without visible history should still be stored as snapshots.
- User collection data is separate and must not be modified by this collector.
