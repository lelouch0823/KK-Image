-- Migration: 0041_add_product_and_variant_codes.sql
-- Description: Add DB-generated stable business codes for products and variants

-- 1) Add new code columns
ALTER TABLE products ADD COLUMN product_code TEXT;
--> statement-breakpoint
ALTER TABLE product_variants ADD COLUMN variant_code TEXT;
--> statement-breakpoint

-- 2) Backfill existing rows using stable ID-derived values
UPDATE products
SET product_code = 'P' || UPPER(SUBSTR(REPLACE(id, '-', ''), 1, 12))
WHERE product_code IS NULL OR TRIM(product_code) = '';
--> statement-breakpoint

UPDATE product_variants
SET variant_code = 'V' || UPPER(SUBSTR(REPLACE(id, '-', ''), 1, 12))
WHERE variant_code IS NULL OR TRIM(variant_code) = '';
--> statement-breakpoint

-- 3) Add uniqueness indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_code ON products(product_code);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_variant_code ON product_variants(variant_code);
--> statement-breakpoint

-- 4) Keep future inserts auto-populated at DB layer
DROP TRIGGER IF EXISTS trg_products_generate_product_code;
--> statement-breakpoint
CREATE TRIGGER trg_products_generate_product_code
AFTER INSERT ON products
FOR EACH ROW
WHEN NEW.product_code IS NULL OR TRIM(NEW.product_code) = ''
BEGIN
    UPDATE products
    SET product_code = 'P' || UPPER(SUBSTR(REPLACE(NEW.id, '-', ''), 1, 12))
    WHERE id = NEW.id;
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_variants_generate_variant_code;
--> statement-breakpoint
CREATE TRIGGER trg_variants_generate_variant_code
AFTER INSERT ON product_variants
FOR EACH ROW
WHEN NEW.variant_code IS NULL OR TRIM(NEW.variant_code) = ''
BEGIN
    UPDATE product_variants
    SET variant_code = 'V' || UPPER(SUBSTR(REPLACE(NEW.id, '-', ''), 1, 12))
    WHERE id = NEW.id;
END;
--> statement-breakpoint
