-- The latest-capture index was unused by production queries. Snapshot lookups
-- are already covered by the table's primary-key index.
DROP INDEX IF EXISTS idx_market_products_latest;
DROP INDEX IF EXISTS idx_market_listing_floor_lookup;
DROP INDEX IF EXISTS idx_market_listing_floor_code;
