-- Migration: 0046_variant_dimensions_mvp.sql
-- Description: Product-scoped dimensions with aliases/values and variant signature dedupe support

CREATE TABLE IF NOT EXISTS product_dimensions (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_dimensions_product ON product_dimensions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_dimensions_product_status ON product_dimensions(product_id, status);

CREATE TABLE IF NOT EXISTS product_dimension_values (
    id TEXT PRIMARY KEY,
    dimension_id TEXT NOT NULL REFERENCES product_dimensions(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_dimension_values_dimension ON product_dimension_values(dimension_id);
CREATE INDEX IF NOT EXISTS idx_product_dimension_values_dimension_status ON product_dimension_values(dimension_id, status);

CREATE TABLE IF NOT EXISTS product_dimension_aliases (
    id TEXT PRIMARY KEY,
    dimension_id TEXT NOT NULL REFERENCES product_dimensions(id) ON DELETE CASCADE,
    from_name TEXT NOT NULL,
    to_name TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_dimension_aliases_dimension ON product_dimension_aliases(dimension_id);

ALTER TABLE product_variants ADD COLUMN variant_signature TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_signature_unique
  ON product_variants(product_id, variant_signature)
  WHERE variant_signature IS NOT NULL AND TRIM(variant_signature) <> '';

UPDATE product_variants
SET variant_signature = options_values
WHERE variant_signature IS NULL OR TRIM(variant_signature) = '';

DROP TRIGGER IF EXISTS trg_product_dimensions_max_active_insert;
CREATE TRIGGER trg_product_dimensions_max_active_insert
BEFORE INSERT ON product_dimensions
WHEN NEW.status = 'active'
BEGIN
  SELECT CASE
    WHEN (
      SELECT COUNT(*)
      FROM product_dimensions
      WHERE product_id = NEW.product_id AND status = 'active'
    ) >= 3
    THEN RAISE(ABORT, 'active dimensions limit reached')
  END;
END;

DROP TRIGGER IF EXISTS trg_product_dimensions_max_active_update;
CREATE TRIGGER trg_product_dimensions_max_active_update
BEFORE UPDATE OF status ON product_dimensions
WHEN NEW.status = 'active' AND OLD.status <> 'active'
BEGIN
  SELECT CASE
    WHEN (
      SELECT COUNT(*)
      FROM product_dimensions
      WHERE product_id = NEW.product_id AND status = 'active'
    ) >= 3
    THEN RAISE(ABORT, 'active dimensions limit reached')
  END;
END;
