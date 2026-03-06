-- Migration: 0043_products_remove_business_fields.sql
-- Description: Hard-cut product business fields to variant-level only

-- Rebuild products table without business fields:
--   price, cost_price, stock_quantity, alert_threshold, status

CREATE TABLE products_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    spu TEXT UNIQUE,
    product_code TEXT,
    slug TEXT,
    category TEXT,
    brand TEXT,
    series TEXT,
    description TEXT,
    images TEXT DEFAULT '[]',
    specifications TEXT DEFAULT '{}',
    options TEXT DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
--> statement-breakpoint

INSERT INTO products_new (
    id, name, spu, product_code, slug, category, brand, series,
    description, images, specifications, options, created_at, updated_at
)
SELECT
    id, name, spu, product_code, slug, category, brand, series,
    description, images, specifications, options, created_at, updated_at
FROM products;
--> statement-breakpoint

DROP TABLE products;
--> statement-breakpoint
ALTER TABLE products_new RENAME TO products;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_spu ON products(spu);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_code ON products(product_code);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
--> statement-breakpoint

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
