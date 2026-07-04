CREATE TABLE IF NOT EXISTS market_indexes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_date TEXT NOT NULL,
  base_value REAL NOT NULL DEFAULT 100,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS market_index_components (
  index_code TEXT NOT NULL,
  apparel_id INTEGER NOT NULL,
  card_id TEXT,
  locale TEXT NOT NULL DEFAULT 'JP',
  code TEXT NOT NULL,
  set_code TEXT,
  card_name TEXT NOT NULL,
  card_name_ko TEXT,
  rarity TEXT,
  note TEXT,
  weight REAL NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  PRIMARY KEY(index_code, apparel_id)
);

CREATE INDEX IF NOT EXISTS idx_market_index_components_code
  ON market_index_components(index_code, code);

CREATE TABLE IF NOT EXISTS market_index_daily_points (
  index_code TEXT NOT NULL,
  condition_key TEXT NOT NULL DEFAULT 'a',
  point_date TEXT NOT NULL,
  index_value REAL NOT NULL,
  active_component_count INTEGER NOT NULL DEFAULT 0,
  component_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'snkrdunk',
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(index_code, condition_key, point_date)
);

CREATE INDEX IF NOT EXISTS idx_market_index_daily_points_date
  ON market_index_daily_points(index_code, condition_key, point_date);

CREATE TABLE IF NOT EXISTS market_index_component_daily_points (
  index_code TEXT NOT NULL,
  condition_key TEXT NOT NULL DEFAULT 'a',
  apparel_id INTEGER NOT NULL,
  point_date TEXT NOT NULL,
  price_jpy INTEGER NOT NULL,
  base_price_jpy INTEGER NOT NULL,
  component_index_value REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'snkrdunk',
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(index_code, condition_key, apparel_id, point_date)
);

CREATE INDEX IF NOT EXISTS idx_market_index_component_daily_points_date
  ON market_index_component_daily_points(index_code, condition_key, point_date);
