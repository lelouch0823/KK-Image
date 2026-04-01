ALTER TABLE purchase_receipts
  ADD COLUMN order_line_id TEXT;

UPDATE purchase_receipts
SET order_line_id = (
  SELECT ie.order_line_id
  FROM inventory_events ie
  WHERE ie.purchase_receipt_id = purchase_receipts.id
    AND ie.event_type = 'purchase_received'
    AND ie.order_line_id IS NOT NULL
  ORDER BY ie.created_at ASC
  LIMIT 1
)
WHERE order_line_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_order_line_id
  ON purchase_receipts(order_line_id);
