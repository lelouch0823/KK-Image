CREATE TABLE inventory_events_new (
  id TEXT PRIMARY KEY,
  variant_id TEXT,
  order_line_id TEXT,
  purchase_receipt_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'purchase_ordered',
    'purchase_received',
    'purchase_arrival',
    'inventory_allocated_to_order_line',
    'inventory_deallocated_from_order_line',
    'inventory_reserved',
    'reservation_hold',
    'inventory_released',
    'reservation_release',
    'order_shipment',
    'order_unshipment',
    'order_line_cancelled',
    'inventory_adjusted_reversal',
    'manual_adjustment'
  )),
  quantity_delta INTEGER NOT NULL,
  source_type TEXT,
  source_id TEXT,
  metadata TEXT,
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  FOREIGN KEY (order_line_id) REFERENCES order_lines(id) ON DELETE SET NULL,
  FOREIGN KEY (purchase_receipt_id) REFERENCES purchase_receipts(id) ON DELETE SET NULL
);

INSERT INTO inventory_events_new (
  id,
  variant_id,
  order_line_id,
  purchase_receipt_id,
  event_type,
  quantity_delta,
  source_type,
  source_id,
  metadata,
  occurred_at,
  created_at
)
SELECT
  id,
  variant_id,
  order_line_id,
  purchase_receipt_id,
  event_type,
  quantity_delta,
  source_type,
  source_id,
  metadata,
  occurred_at,
  created_at
FROM inventory_events;

DROP TABLE inventory_events;
ALTER TABLE inventory_events_new RENAME TO inventory_events;

CREATE INDEX IF NOT EXISTS idx_inventory_events_variant_occurred_at
  ON inventory_events(variant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_events_order_line_id
  ON inventory_events(order_line_id);
CREATE INDEX IF NOT EXISTS idx_inventory_events_purchase_receipt_id
  ON inventory_events(purchase_receipt_id);
CREATE INDEX IF NOT EXISTS idx_inventory_events_source
  ON inventory_events(source_type, source_id);
