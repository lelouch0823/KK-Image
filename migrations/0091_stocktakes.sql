-- 库存盘点 (Stocktake)
CREATE TABLE IF NOT EXISTS stocktakes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','counting','adjusted','cancelled')),
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    completed_at INTEGER,
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS stocktake_items (
    id TEXT PRIMARY KEY,
    stocktake_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    system_qty INTEGER NOT NULL DEFAULT 0,
    actual_qty INTEGER CHECK(actual_qty >= 0),
    difference INTEGER,
    notes TEXT,
    FOREIGN KEY (stocktake_id) REFERENCES stocktakes(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stocktake_items_stocktake ON stocktake_items(stocktake_id);
CREATE INDEX IF NOT EXISTS idx_stocktake_items_variant ON stocktake_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_stocktakes_status ON stocktakes(status);
