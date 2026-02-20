-- Migration: 0033_add_product_id_to_spaces.sql
-- Description: Add product_id to spaces to allow associating actual products with spaces

ALTER TABLE spaces ADD COLUMN product_id TEXT REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_spaces_product_id ON spaces(product_id);
