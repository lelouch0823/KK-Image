-- Migration: 0037_product_variants.sql
-- Description: Implement SOTA Product + Variant Model

-- 1. Create Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT UNIQUE NOT NULL,
    price REAL DEFAULT 0,
    cost_price REAL,
    stock_quantity INTEGER DEFAULT 0,
    options_values TEXT DEFAULT '{}', -- JSON: {"Color": "Red", "Size": "S"}
    image_id TEXT, -- specific variant image
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);

-- 2. Add properties to existing structures
ALTER TABLE products ADD COLUMN options TEXT DEFAULT '[]';

-- 3. Modify orders and related tables to reference variants
ALTER TABLE orders ADD COLUMN variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_variant ON orders(variant_id);

ALTER TABLE purchase_order_items ADD COLUMN variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_po_items_variant ON purchase_order_items(variant_id);

ALTER TABLE spaces ADD COLUMN variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_spaces_variant_id ON spaces(variant_id);
