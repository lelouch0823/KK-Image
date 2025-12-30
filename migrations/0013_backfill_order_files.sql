
-- Backfill order_files from orders.main_image_id
INSERT OR IGNORE INTO order_files (id, order_id, file_id, section, sort_order, added_at)
SELECT 
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), -- Generate UUID
  id, 
  main_image_id, 
  'product', 
  0, 
  created_at
FROM orders 
WHERE main_image_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM order_files WHERE order_id = orders.id);
