CREATE TABLE IF NOT EXISTS purchase_receipt_reversals (
  id TEXT PRIMARY KEY,
  original_receipt_id TEXT NOT NULL,
  purchase_order_id TEXT NOT NULL,
  purchase_order_item_id TEXT,
  reversal_qty INTEGER NOT NULL,
  reason TEXT,
  command_id TEXT NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (original_receipt_id) REFERENCES purchase_receipts(id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipt_reversals_original_receipt
  ON purchase_receipt_reversals(original_receipt_id, created_at DESC);
