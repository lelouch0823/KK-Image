-- 0044_variant_ops_fields.sql
-- Add operational fields for variant-level replenishment and external code integrations

ALTER TABLE product_variants ADD COLUMN moq INTEGER NOT NULL DEFAULT 1;
ALTER TABLE product_variants ADD COLUMN pack_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE product_variants ADD COLUMN order_step INTEGER NOT NULL DEFAULT 1;
ALTER TABLE product_variants ADD COLUMN suggested_purchase_price REAL NOT NULL DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN barcode TEXT;
ALTER TABLE product_variants ADD COLUMN supplier_sku TEXT;

CREATE INDEX IF NOT EXISTS idx_product_variants_supplier_sku ON product_variants(supplier_sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_barcode_unique
  ON product_variants(barcode) WHERE barcode IS NOT NULL AND TRIM(barcode) <> '';

