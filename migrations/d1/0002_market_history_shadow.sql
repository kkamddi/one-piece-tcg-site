PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS market_price_latest_snapshots (
  source TEXT NOT NULL DEFAULT 'snkrdunk',
  apparel_id INTEGER NOT NULL,
  locale TEXT NOT NULL DEFAULT 'JP',
  code TEXT NOT NULL,
  min_price_amount REAL,
  min_price_currency TEXT,
  min_price_text TEXT,
  listing_count INTEGER,
  captured_at TEXT NOT NULL,
  raw_payload_r2_key TEXT,
  updated_at TEXT,
  PRIMARY KEY(source, apparel_id)
);

CREATE INDEX IF NOT EXISTS idx_market_price_latest_code
  ON market_price_latest_snapshots(locale, code);
CREATE INDEX IF NOT EXISTS idx_market_price_latest_captured
  ON market_price_latest_snapshots(captured_at DESC);

CREATE TABLE IF NOT EXISTS market_collection_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'snkrdunk',
  collector_version TEXT,
  schedule_interval TEXT,
  status TEXT,
  target_count INTEGER DEFAULT 0,
  ok_count INTEGER DEFAULT 0,
  locked_count INTEGER DEFAULT 0,
  with_history_count INTEGER DEFAULT 0,
  with_chart_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  started_at TEXT,
  finished_at TEXT,
  notes TEXT,
  meta_json TEXT,
  raw_payload_r2_prefix TEXT
);

CREATE INDEX IF NOT EXISTS idx_market_collection_runs_started
  ON market_collection_runs(source, started_at DESC);

CREATE TABLE IF NOT EXISTS market_raw_payload_index (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'snkrdunk',
  payload_type TEXT NOT NULL,
  apparel_id INTEGER,
  code TEXT,
  condition_key TEXT,
  captured_at TEXT,
  r2_key TEXT NOT NULL,
  content_encoding TEXT NOT NULL DEFAULT 'gzip',
  content_type TEXT NOT NULL DEFAULT 'application/json',
  byte_size INTEGER,
  sha256 TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_market_raw_payload_product
  ON market_raw_payload_index(source, apparel_id, payload_type, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_raw_payload_code
  ON market_raw_payload_index(source, code, payload_type, captured_at DESC);
