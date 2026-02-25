-- Variant audit trail for create/update/archive operations
CREATE TABLE IF NOT EXISTS variant_audit_logs (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  action TEXT NOT NULL,
  changes_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_variant_audit_logs_variant_time
ON variant_audit_logs (variant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_variant_audit_logs_product_time
ON variant_audit_logs (product_id, created_at DESC);
