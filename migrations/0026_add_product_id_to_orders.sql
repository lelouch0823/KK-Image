-- Add product_id to orders table
ALTER TABLE orders ADD COLUMN product_id TEXT;

-- Add index for potential filtering
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
