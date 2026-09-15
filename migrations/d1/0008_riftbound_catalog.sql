CREATE TABLE IF NOT EXISTS riftbound_catalog_editions (
  locale TEXT PRIMARY KEY CHECK (locale IN ('KR', 'EN', 'CN')),
  revision TEXT NOT NULL,
  card_count INTEGER NOT NULL CHECK (card_count > 0),
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json))
);

CREATE TABLE IF NOT EXISTS riftbound_catalog_sets (
  locale TEXT NOT NULL REFERENCES riftbound_catalog_editions(locale),
  set_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  set_json TEXT NOT NULL CHECK (json_valid(set_json)),
  product_json TEXT CHECK (product_json IS NULL OR json_valid(product_json)),
  PRIMARY KEY (locale, set_id)
);

CREATE TABLE IF NOT EXISTS riftbound_catalog_cards (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL,
  set_id TEXT NOT NULL,
  code TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  card_json TEXT NOT NULL CHECK (json_valid(card_json)),
  FOREIGN KEY (locale, set_id) REFERENCES riftbound_catalog_sets(locale, set_id),
  CHECK (id LIKE 'riftbound:' || locale || ':%'),
  CHECK (json_extract(card_json, '$.id') = id),
  CHECK (json_extract(card_json, '$.set') = set_id)
);
CREATE INDEX IF NOT EXISTS idx_riftbound_cards_locale_id ON riftbound_catalog_cards(locale, id);
CREATE INDEX IF NOT EXISTS idx_riftbound_cards_set ON riftbound_catalog_cards(locale, set_id);
