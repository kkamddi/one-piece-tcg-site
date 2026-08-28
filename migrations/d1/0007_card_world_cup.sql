CREATE TABLE IF NOT EXISTS card_world_cup_events (
  event_id TEXT PRIMARY KEY,
  round_size INTEGER NOT NULL,
  champion_card_id TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS card_world_cup_stats (
  card_id TEXT PRIMARY KEY,
  card_no TEXT NOT NULL DEFAULT '',
  card_name TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  titles INTEGER NOT NULL DEFAULT 0,
  match_wins INTEGER NOT NULL DEFAULT 0,
  matches INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_card_world_cup_stats_rank
  ON card_world_cup_stats(titles DESC, match_wins DESC);

CREATE TABLE IF NOT EXISTS card_world_cup_totals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  completed_tournaments INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
