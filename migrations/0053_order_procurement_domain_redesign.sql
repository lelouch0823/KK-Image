-- Migration: 0053_order_procurement_domain_redesign.sql
-- Description: Introduce order/procurement domain foundation tables for line-level fulfillment,
--              receipt records, allocation links, and inventory event source-of-truth.

CREATE TABLE IF NOT EXISTS order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  variant_id TEXT,
  snapshot_name TEXT NOT NULL,
  snapshot_sku TEXT,
  snapshot_specs TEXT,
  snapshot_image TEXT,
  ordered_qty INTEGER NOT NULL DEFAULT 0,
  procured_qty INTEGER NOT NULL DEFAULT 0,
  received_qty INTEGER NOT NULL DEFAULT 0,
  reserved_qty INTEGER NOT NULL DEFAULT 0,
  shipped_qty INTEGER NOT NULL DEFAULT 0,
  cancelled_qty INTEGER NOT NULL DEFAULT 0,
  display_status TEXT NOT NULL DEFAULT 'unprocured' CHECK(display_status IN (
    'unprocured',
    'partially_procured',
    'fully_procured',
    'partially_received',
    'ready',
    'partially_shipped',
    'completed',
    'cancelled'
  )),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_lines_order_id
  ON order_lines(order_id);

CREATE INDEX IF NOT EXISTS idx_order_lines_variant_id
  ON order_lines(variant_id);

CREATE INDEX IF NOT EXISTS idx_order_lines_display_status
  ON order_lines(display_status);

CREATE TABLE IF NOT EXISTS purchase_receipts (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL,
  purchase_order_item_id TEXT,
  product_id TEXT,
  variant_id TEXT,
  receipt_no TEXT,
  received_qty INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  received_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase_order_id
  ON purchase_receipts(purchase_order_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase_order_item_id
  ON purchase_receipts(purchase_order_item_id);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_variant_id
  ON purchase_receipts(variant_id);

CREATE TABLE IF NOT EXISTS inventory_events (
  id TEXT PRIMARY KEY,
  variant_id TEXT,
  order_line_id TEXT,
  purchase_receipt_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'purchase_ordered',
    'purchase_received',
    'inventory_allocated_to_order_line',
    'inventory_deallocated_from_order_line',
    'inventory_reserved',
    'inventory_released',
    'order_line_cancelled',
    'inventory_adjusted_reversal'
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

CREATE INDEX IF NOT EXISTS idx_inventory_events_variant_occurred_at
  ON inventory_events(variant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_events_order_line_id
  ON inventory_events(order_line_id);

CREATE INDEX IF NOT EXISTS idx_inventory_events_purchase_receipt_id
  ON inventory_events(purchase_receipt_id);

CREATE INDEX IF NOT EXISTS idx_inventory_events_source
  ON inventory_events(source_type, source_id);

CREATE TABLE IF NOT EXISTS order_line_allocations (
  id TEXT PRIMARY KEY,
  order_line_id TEXT NOT NULL,
  variant_id TEXT,
  inventory_event_id TEXT,
  allocated_qty INTEGER NOT NULL DEFAULT 0,
  released_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'released', 'cancelled')),
  allocated_at INTEGER NOT NULL,
  released_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (order_line_id) REFERENCES order_lines(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  FOREIGN KEY (inventory_event_id) REFERENCES inventory_events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_line_allocations_order_line_id
  ON order_line_allocations(order_line_id);

CREATE INDEX IF NOT EXISTS idx_order_line_allocations_variant_id
  ON order_line_allocations(variant_id);

CREATE INDEX IF NOT EXISTS idx_order_line_allocations_status
  ON order_line_allocations(status);
