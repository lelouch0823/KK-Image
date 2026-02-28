-- 0047_variant_barcode_unique_active_only.sql
-- Allow barcode reuse on archived variants while keeping active variants unique.

DROP INDEX IF EXISTS idx_product_variants_barcode_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_barcode_unique
  ON product_variants(barcode)
  WHERE barcode IS NOT NULL
    AND TRIM(barcode) <> ''
    AND status = 'active';

