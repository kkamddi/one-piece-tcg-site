# Cloudflare D1 Public Data Migration Plan

Status: planning only.

This document defines the intended D1 schema and migration order for splitting public/static data from Supabase. It does not require deleting Supabase data, changing collector writes, or running a D1 migration yet.

## 1. Target Data Split

Keep in Supabase:

- Auth and Kakao login
- User accounts and identity-linked profile data
- User-owned cards, wishlist, portfolio, valuation items, deck saves
- Community posts/comments and any author-identifiable data
- Admin-only operational state until explicitly moved

Move or mirror to Cloudflare D1:

- Public card catalogue data
- `card_series`
- Public card search aliases
- Public market product metadata
- Compressed market chart points
- Recent market trades
- Approved/pending card-market mapping metadata
- Shops
- News/notices

Do not move raw user state into D1. D1 should be treated as a public/read-heavy data store unless a separate authenticated design is explicitly added later.

## 2. Final D1 Schema SQL

SQLite-compatible schema for Cloudflare D1:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS card_series (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL,
  base_series_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  kind_ko TEXT,
  kind_en TEXT,
  official_series_keyword TEXT,
  official_url TEXT,
  description TEXT,
  release_order INTEGER NOT NULL DEFAULT 0,
  card_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_card_series_locale_order
  ON card_series(locale, release_order DESC, base_series_id);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL,
  card_no TEXT NOT NULL,
  card_no_base TEXT NOT NULL,
  variant_key TEXT NOT NULL DEFAULT 'base',
  series_id TEXT NOT NULL,
  base_series_id TEXT NOT NULL,
  origin_series_id TEXT,
  origin_base_series_id TEXT,
  name TEXT NOT NULL,
  name_en TEXT,
  name_normalized TEXT NOT NULL,
  search_text_normalized TEXT NOT NULL DEFAULT '',
  rarity TEXT,
  category TEXT,
  category_ko TEXT,
  color TEXT,
  color_ko TEXT,
  cost TEXT,
  power TEXT,
  counter TEXT,
  attribute TEXT,
  attribute_ko TEXT,
  type TEXT,
  effect TEXT,
  image_url TEXT,
  official_url TEXT,
  image_status TEXT NOT NULL DEFAULT 'unknown',
  image_checked_at TEXT,
  market_code TEXT NOT NULL,
  is_reprint INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_updated_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY(series_id) REFERENCES card_series(id)
);

CREATE INDEX IF NOT EXISTS idx_cards_locale_series
  ON cards(locale, series_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cards_locale_no
  ON cards(locale, card_no);
CREATE INDEX IF NOT EXISTS idx_cards_locale_base
  ON cards(locale, card_no_base);
CREATE INDEX IF NOT EXISTS idx_cards_market_code
  ON cards(locale, market_code);
CREATE INDEX IF NOT EXISTS idx_cards_search
  ON cards(locale, name_normalized, search_text_normalized);

CREATE TABLE IF NOT EXISTS card_search_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'generated',
  created_at TEXT,
  FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_card_search_aliases_lookup
  ON card_search_aliases(locale, alias_normalized);
CREATE INDEX IF NOT EXISTS idx_card_search_aliases_card
  ON card_search_aliases(card_id);

CREATE TABLE IF NOT EXISTS market_products (
  source TEXT NOT NULL DEFAULT 'snkrdunk',
  apparel_id INTEGER NOT NULL,
  locale TEXT NOT NULL DEFAULT 'JP',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  set_name TEXT,
  source_url TEXT NOT NULL,
  preview_image_url TEXT,
  latest_a_price_jpy INTEGER,
  latest_psa10_price_jpy INTEGER,
  latest_min_price_amount REAL,
  latest_min_price_currency TEXT,
  latest_listing_count INTEGER,
  latest_captured_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  raw_market_card_json TEXT,
  created_at TEXT,
  updated_at TEXT,
  PRIMARY KEY(source, apparel_id)
);

CREATE INDEX IF NOT EXISTS idx_market_products_locale_code
  ON market_products(locale, code);
CREATE INDEX IF NOT EXISTS idx_market_products_latest
  ON market_products(latest_captured_at DESC);

CREATE TABLE IF NOT EXISTS market_chart_daily_points (
  source TEXT NOT NULL DEFAULT 'snkrdunk',
  apparel_id INTEGER NOT NULL,
  locale TEXT NOT NULL DEFAULT 'JP',
  code TEXT NOT NULL,
  condition_key TEXT NOT NULL,
  point_date TEXT NOT NULL,
  median_price_jpy INTEGER NOT NULL,
  min_price_jpy INTEGER NOT NULL,
  max_price_jpy INTEGER NOT NULL,
  trade_count INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  PRIMARY KEY(source, apparel_id, condition_key, point_date)
);

CREATE INDEX IF NOT EXISTS idx_market_chart_product_date
  ON market_chart_daily_points(source, apparel_id, condition_key, point_date);
CREATE INDEX IF NOT EXISTS idx_market_chart_code_date
  ON market_chart_daily_points(locale, code, condition_key, point_date);

CREATE TABLE IF NOT EXISTS market_recent_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'snkrdunk',
  apparel_id INTEGER NOT NULL,
  locale TEXT NOT NULL DEFAULT 'JP',
  code TEXT NOT NULL,
  condition_key TEXT NOT NULL,
  trade_date TEXT,
  trade_date_text TEXT,
  price_amount_jpy INTEGER NOT NULL,
  price_text TEXT,
  first_seen_at TEXT,
  last_seen_at TEXT,
  raw_payload_json TEXT,
  UNIQUE(source, apparel_id, condition_key, trade_date_text, price_amount_jpy)
);

CREATE INDEX IF NOT EXISTS idx_market_recent_product_date
  ON market_recent_trades(source, apparel_id, condition_key, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_recent_code_date
  ON market_recent_trades(locale, code, condition_key, trade_date DESC);

CREATE TABLE IF NOT EXISTS card_market_links (
  card_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'snkrdunk',
  card_no TEXT NOT NULL,
  locale TEXT NOT NULL,
  variant_key TEXT NOT NULL DEFAULT '',
  apparel_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  updated_at TEXT,
  PRIMARY KEY(card_id, source)
);

CREATE INDEX IF NOT EXISTS idx_card_market_links_status
  ON card_market_links(status, locale, card_no);
CREATE INDEX IF NOT EXISTS idx_card_market_links_apparel
  ON card_market_links(source, apparel_id);

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT,
  source_label TEXT,
  sido TEXT,
  gungu TEXT,
  address TEXT,
  phone TEXT,
  official_url TEXT,
  lat REAL,
  lng REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_shops_region
  ON shops(sido, gungu, source_type);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL DEFAULT 'KR',
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  source TEXT,
  source_url TEXT,
  published_at TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_news_locale_published
  ON news(locale, published_at DESC, display_order DESC);
```

## 3. Supabase Export and D1 Import Method

Recommended approach:

1. Export Supabase public tables into JSONL or CSV using a local script with the service role key.
2. Transform Postgres-shaped rows into SQLite-safe rows:
   - Convert `jsonb` to JSON text.
   - Convert timestamps to ISO strings.
   - Convert booleans to `0` or `1`.
   - Normalize empty `variant_key` to `base` for `cards`, and to empty string for `card_market_links` if current frontend expects that.
3. Create D1 tables with `wrangler d1 execute <DB> --file schema.sql`.
4. Import in batches:
   - `card_series`
   - `cards`
   - `card_search_aliases`
   - `market_products`
   - `market_chart_daily_points`
   - `market_recent_trades`
   - `card_market_links`
   - `shops`
   - `news`
5. Keep Supabase as the source of truth until the D1 read path is verified.

Do not import user-owned card state, wishlists, portfolio, decks, or community data into D1.

## 4. Extracting Latest Price From `market_price_snapshots`

Use one latest successful row per product:

```sql
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
```

For latest A/PSA10 prices, prefer the latest valid point per product and condition:

```sql
SELECT DISTINCT ON (source, apparel_id, condition_key)
  source,
  apparel_id,
  locale,
  code,
  condition_key,
  price_amount,
  point_date,
  captured_at
FROM market_chart_points
WHERE price_amount > 0
  AND condition_key IN ('a', 'psa10')
ORDER BY source, apparel_id, condition_key, point_date DESC, captured_at DESC;
```

Merge these into D1 `market_products.latest_a_price_jpy`, `latest_psa10_price_jpy`, `latest_min_price_amount`, `latest_min_price_currency`, `latest_listing_count`, and `latest_captured_at`.

## 5. Compressing `market_chart_points`

Store one daily row per product and condition using median/min/max/count.

Postgres extraction query:

```sql
WITH normalized AS (
  SELECT
    source,
    apparel_id,
    locale,
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
  point_day,
  ROUND(median_price)::integer AS median_price_jpy,
  ROUND(min_price)::integer AS min_price_jpy,
  ROUND(max_price)::integer AS max_price_jpy,
  trade_count,
  trade_count AS source_count
FROM daily
ORDER BY source, apparel_id, condition_key, point_day;
```

Frontend chart policy:

- `7D`: read daily points for the last 7 days.
- `1M`: read daily points for the last 30 days.
- `ALL`: read all daily points. If payload becomes too large later, add server-side monthly downsampling only for `ALL`.
- Render median as the primary line. Use min/max only for tooltip or future range band.

## 6. API File Modification Plan

No code should be changed in step 1. When implementation starts, use this order.

New files:

- `lib/d1-client.js`: resolves the Cloudflare D1 binding from Pages Functions context.
- `lib/d1-card-store.js`: D1 implementations for reading cards, series, search aliases, and card detail.
- `lib/d1-market-store.js`: D1 implementations for market products, latest price, daily chart points, recent trades, and card-market links.
- `lib/d1-shops-store.js`: D1 shops/news read helpers if not folded into one store.

Existing files to change later:

- `lib/cards-store.js`
  - Add `PUBLIC_DATA_SOURCE` routing.
  - D1 first when `PUBLIC_DATA_SOURCE=d1`.
  - Supabase fallback when D1 errors or returns empty for critical reads.
  - Static fallback remains the final safety net.

- `api/cards/index.js`, `api/cards/search.js`, `api/cards/[id].js`, `api/series.js`
  - Prefer preserving current store interfaces so these files need minimal or no changes.

- `api/market.js`
  - Add `MARKET_DATA_SOURCE` routing for read paths.
  - D1 first for product metadata, chart daily points, and recent trades.
  - Supabase fallback for reads.
  - Keep collector writes unchanged until the later write-migration phase.

- `api/market-collector.js`
  - No write target change in phase 1 or phase 2.
  - Later phase can write compressed D1 rows after Supabase fallback is proven.

- `api/shops/index.js`
  - Read D1 shops when `PUBLIC_DATA_SOURCE=d1`.
  - Fallback to current bundled JSON/Supabase path.

- `api/news` or the current notice implementation
  - Add D1 news reads later if news becomes a first-class route.

- `lib/user-state-store.js`, `api/me.js`, `api/auth/*`, `api/community/*`
  - Keep Supabase-only.
  - Do not route user identity or user state through D1 in this migration.

- `functions/api/[[path]].js`
  - Verify the Cloudflare Pages function context/env is passed to handlers before implementing D1 reads.

## 7. Environment Variables

Recommended defaults before D1 verification:

```txt
PUBLIC_DATA_SOURCE=supabase
MARKET_DATA_SOURCE=supabase
```

Valid values:

- `PUBLIC_DATA_SOURCE=d1|supabase|static`
- `MARKET_DATA_SOURCE=d1|supabase`

Cloudflare binding:

- `PUBLIC_DB` or `OPTCG_PUBLIC_DB`: D1 database binding name.
- Prefer a fixed binding name in code, not a dynamic environment-variable lookup, unless Pages Function constraints require indirection.

Existing variables stay:

- Supabase URL and keys for Auth/user/community/fallback.
- Kakao Auth config.
- `MARKET_COLLECTOR_TOKEN`.

## 8. Verification Checklist

Before migration:

- Record Supabase row counts for public tables.
- Record D1 target export counts.
- Save sample API responses:
  - `/api/cards?locale=JP`
  - `/api/cards?locale=JP&q=ルフィ`
  - `/api/cards?locale=JP&q=루피`
  - `/api/cards?locale=JP&series=JP-OP16`
  - `/api/market?code=OP05-119&apparelId=135437`
  - `/api/shops?action=regions`
- Verify login, logout, Kakao login, portfolio, owned cards, wishlist, and decks still use Supabase.

After D1 shadow import:

- Compare D1 counts against export counts.
- Randomly verify at least 20 card IDs across KR/JP, base/parallel/reprint.
- Verify image URLs for cards and portfolio cards.
- Verify market product samples:
  - `OP05-119`
  - `ST21-014`
  - `P-046`
  - OP16 products when mapped
- Verify `7D`, `1M`, `ALL` chart ranges read from daily points.
- Verify recent trades are limited in UI but retained in D1.
- Verify shops and news render if moved.

Before switching production reads:

- Enable D1 on a preview deployment only.
- Test desktop and mobile main pages.
- Test card catalogue search, filters, detail modal, market button, and fallback.
- Test authenticated user state after login.
- Confirm no Supabase user tables were modified.

## 9. Rollback Method

Primary rollback:

```txt
PUBLIC_DATA_SOURCE=supabase
MARKET_DATA_SOURCE=supabase
```

Then redeploy or update Cloudflare Pages environment variables.

Safety properties:

- Supabase remains intact.
- Collector continues writing to Supabase until a later approved phase.
- D1 data can be dropped/reimported without user data loss.
- If a production deploy is bad, roll back to the previous Cloudflare Pages deployment.

Do not delete `market_price_snapshots` or `market_chart_points` until D1 has been stable for at least 7-14 days and an export backup exists.

## 10. Safest Phase Order

Phase 1: planning only

- Finalize this schema and migration plan.
- No data mutation.
- No app code change.

Phase 2: D1 shadow database

- Create D1 database and tables.
- Export public data from Supabase/static files.
- Import into D1.
- Import compressed market daily points and recent trades.
- Keep app reads on Supabase/static.
- Keep collector writes on Supabase.

Phase 3: D1 read path behind environment flags

- Implement D1 stores.
- Enable D1 for cards/series on preview only.
- Enable D1 for shops/news on preview.
- Enable D1 for market read on preview.
- Keep Supabase fallback active.
- Do not delete Supabase data.

Phase 4: production read switch

- Switch `PUBLIC_DATA_SOURCE=d1`.
- Switch `MARKET_DATA_SOURCE=d1` after market chart checks pass.
- Monitor card search, market detail, portfolio image resolution, and auth/user state.

Phase 5: storage reduction

- Change collector to write compact daily/latest structures only after read stability.
- Keep raw snapshots for a short retention window.
- Back up old raw data.
- Prune old Supabase-heavy market tables only after explicit approval.

## 11. Highest Impact Priority

For Supabase free-plan pressure, the biggest wins are:

1. Compress `market_chart_points` into `market_chart_daily_points`.
2. Convert `market_price_snapshots` into latest product fields plus short retention raw snapshots.
3. Move public cards/series and market metadata reads to D1.
4. Move shops/news to D1.
5. Leave user state in Supabase.

