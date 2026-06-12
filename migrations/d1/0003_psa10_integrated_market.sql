PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS psa10_market_links (
  card_id TEXT PRIMARY KEY,
  card_no TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'JP',
  name TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT 'PSA10',
  search_query TEXT NOT NULL,
  match_basis_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  confidence INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_psa10_market_links_lookup
  ON psa10_market_links(locale, card_no, status);

CREATE TABLE IF NOT EXISTS psa10_market_trades (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  card_no TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'JP',
  grade TEXT NOT NULL DEFAULT 'PSA10',
  source TEXT NOT NULL DEFAULT 'psa',
  platform TEXT,
  sold_at TEXT NOT NULL,
  price_usd REAL NOT NULL,
  price_krw INTEGER,
  title TEXT,
  raw_title TEXT,
  source_url TEXT,
  lot_number TEXT,
  confidence INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_psa10_market_trades_card_date
  ON psa10_market_trades(card_id, sold_at DESC);

CREATE INDEX IF NOT EXISTS idx_psa10_market_trades_status
  ON psa10_market_trades(status, sold_at DESC);

CREATE TABLE IF NOT EXISTS psa10_market_daily_points (
  card_id TEXT NOT NULL,
  point_date TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT 'PSA10',
  source TEXT NOT NULL DEFAULT 'integrated',
  median_usd REAL NOT NULL,
  min_usd REAL NOT NULL,
  max_usd REAL NOT NULL,
  trade_count INTEGER NOT NULL DEFAULT 0,
  sources_json TEXT,
  updated_at TEXT,
  PRIMARY KEY(card_id, point_date, grade, source)
);

CREATE INDEX IF NOT EXISTS idx_psa10_market_daily_points_card_date
  ON psa10_market_daily_points(card_id, point_date);
