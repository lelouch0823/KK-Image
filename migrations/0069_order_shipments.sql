CREATE TABLE IF NOT EXISTS order_shipments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_line_id TEXT NOT NULL,
    variant_id TEXT,
    action_type TEXT NOT NULL CHECK(action_type IN ('shipped', 'unshipped')),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    note TEXT NOT NULL DEFAULT '',
    created_by TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (order_line_id) REFERENCES order_lines(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_shipments_order_id
    ON order_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_order_line_id
    ON order_shipments(order_line_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_variant_id
    ON order_shipments(variant_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_action_type
    ON order_shipments(action_type);
CREATE INDEX IF NOT EXISTS idx_order_shipments_created_at
    ON order_shipments(created_at DESC);
