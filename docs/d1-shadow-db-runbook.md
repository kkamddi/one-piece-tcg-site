# D1 Shadow DB Runbook

Status: shadow database prepared. Production app reads are not switched to D1.

## Shadow DB

- Database name: `optcgkorea-public-shadow`
- Database id: `da59fbad-d4bb-4f4a-88cc-37b0a698646a`
- Region: APAC

Do not bind this database to production reads until the D1-first read path is implemented and verified on preview.

## Files

- Schema migration: `migrations/d1/0001_public_shadow.sql`
- Seed generator: `scripts/prepareD1PublicSeed.js`
- Market daily draft generator: `scripts/prepareD1MarketDailyDraft.js`
- Generated seed directory: `data/d1-public-seed/`

## Regenerate Seed Files

```powershell
node scripts\prepareD1PublicSeed.js
node scripts\prepareD1MarketDailyDraft.js
```

Expected manifest after the current data set:

```json
{
  "card_series": 84,
  "cards": 7031,
  "market_products": 9291,
  "card_market_links": 1459,
  "shops": 80,
  "news": 4
}
```

## Apply Schema

```powershell
npx.cmd wrangler d1 execute optcgkorea-public-shadow --remote --file migrations/d1/0001_public_shadow.sql
```

## Import Public Seed Data

Run these sequentially:

```powershell
npx.cmd wrangler d1 execute optcgkorea-public-shadow --remote --file data/d1-public-seed/001_card_series.sql
npx.cmd wrangler d1 execute optcgkorea-public-shadow --remote --file data/d1-public-seed/002_cards.sql
npx.cmd wrangler d1 execute optcgkorea-public-shadow --remote --file data/d1-public-seed/003_market_products.sql
npx.cmd wrangler d1 execute optcgkorea-public-shadow --remote --file data/d1-public-seed/004_card_market_links.sql
npx.cmd wrangler d1 execute optcgkorea-public-shadow --remote --file data/d1-public-seed/005_shops.sql
npx.cmd wrangler d1 execute optcgkorea-public-shadow --remote --file data/d1-public-seed/006_news.sql
```

The seed generator intentionally uses small INSERT batches to avoid D1 `SQLITE_TOOBIG` errors.

## Verification Queries

```sql
SELECT COUNT(*) AS card_series FROM card_series;
SELECT COUNT(*) AS cards FROM cards;
SELECT COUNT(*) AS market_products FROM market_products;
SELECT COUNT(*) AS card_market_links FROM card_market_links;
SELECT COUNT(*) AS shops FROM shops;
SELECT COUNT(*) AS news FROM news;
```

Current verified remote counts:

- `card_series`: 84
- `cards`: 7031
- `market_products`: 9291
- `card_market_links`: 1459
- `shops`: 80
- `news`: 4

Representative sample checks passed:

- `JP::OP05-119`
- `JP::P-046`
- `KR::OP01-001`
- `market_products.apparel_id` 135437 and 136542
- `card_market_links` for `JP::OP05-119` and `JP::P-046`
- Shops sample rows

Current remote DB size after seed import: about 19.10 MB.

## Large Market History

These files are drafts only and were not imported:

- `data/d1-public-seed/draft_market_chart_daily_points_export.sql`
- `data/d1-public-seed/draft_market_latest_price_export.sql`

They define how to export:

- latest price from `market_price_snapshots`
- daily median/min/max/trade_count from `market_chart_points`

No Supabase history tables were deleted or modified.

## Rollback

No production code or environment variable currently depends on this D1 database. To abandon the shadow DB, leave production env vars unchanged:

```txt
PUBLIC_DATA_SOURCE=supabase
MARKET_DATA_SOURCE=supabase
```

