-- Card detail lookups use source, activity status, and a case-insensitive code.
-- Keeping the expression out of the query lets D1 avoid scanning every product.
CREATE INDEX IF NOT EXISTS idx_market_products_active_code_nocase
  ON market_products(source, is_active, code COLLATE NOCASE);
