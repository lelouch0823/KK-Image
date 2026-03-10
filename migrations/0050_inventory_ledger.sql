CREATE TABLE IF NOT EXISTS inventory_ledger (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  occurred_at INTEGER NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_variant_occurred_at
  ON inventory_ledger(variant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_reference
  ON inventory_ledger(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS inventory_balances (
  variant_id TEXT PRIMARY KEY,
  on_hand INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_available
  ON inventory_balances(available DESC);
