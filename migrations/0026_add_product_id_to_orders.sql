-- Add product_id to orders table
-- 注意：0021_add_products.sql 已经包含了此字段，故在本地环境将其注释以避免冲突。
-- ALTER TABLE orders ADD COLUMN product_id TEXT;

-- Add index for potential filtering
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
