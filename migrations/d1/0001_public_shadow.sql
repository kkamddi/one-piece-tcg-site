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
