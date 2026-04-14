-- Migration number: 0068   2026-04-14
-- Expand delivery status for partial returns and promote order_returns pending -> requested.

PRAGMA foreign_keys = OFF;

CREATE TABLE orders_new (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    salesperson_id TEXT NOT NULL,
    customer_id TEXT,
    product_id TEXT,
    variant_id TEXT,
    quantity INTEGER DEFAULT 1,
    original_data TEXT NOT NULL,
    current_data TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending',
        'confirmed',
        'rejected',
        'production',
        'shipping',
        'arrived',
        'fulfilled',
        'delivered',
        'void'
    )),
    procurement_status TEXT NOT NULL DEFAULT 'none' CHECK(procurement_status IN (
        'none',
        'planned',
        'ordered',
        'partially_arrived',
        'arrived'
    )),
    fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled' CHECK(fulfillment_status IN (
        'unfulfilled',
        'partially_fulfilled',
        'fulfilled'
    )),
    delivery_status TEXT NOT NULL DEFAULT 'not_shipped' CHECK(delivery_status IN (
        'not_shipped',
        'in_transit',
        'delivered',
        'partially_returned',
        'returned'
    )),
    delivered_at INTEGER,
    delivered_by TEXT,
    delivery_note TEXT NOT NULL DEFAULT '',
    main_image_id TEXT,
    has_new_feedback INTEGER DEFAULT 0,
    unread_by_admin INTEGER DEFAULT 1,
    unread_by_sales INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (salesperson_id) REFERENCES salespersons(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    FOREIGN KEY (main_image_id) REFERENCES files(id) ON DELETE SET NULL
);

INSERT INTO orders_new (
    id,
    order_no,
    salesperson_id,
    customer_id,
    product_id,
    variant_id,
    quantity,
    original_data,
    current_data,
    status,
    procurement_status,
    fulfillment_status,
    delivery_status,
    delivered_at,
    delivered_by,
    delivery_note,
    main_image_id,
    has_new_feedback,
    unread_by_admin,
    unread_by_sales,
    created_at,
    updated_at
)
SELECT
    id,
    order_no,
    salesperson_id,
    customer_id,
    product_id,
    variant_id,
    quantity,
    original_data,
    current_data,
    status,
    procurement_status,
    fulfillment_status,
    CASE
        WHEN delivery_status = 'returned' THEN 'returned'
        ELSE delivery_status
    END,
    delivered_at,
    delivered_by,
    COALESCE(delivery_note, ''),
    main_image_id,
    has_new_feedback,
    unread_by_admin,
    unread_by_sales,
    created_at,
    updated_at
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

CREATE INDEX IF NOT EXISTS idx_orders_salesperson ON orders(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_variant_id ON orders(variant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_unread_admin ON orders(unread_by_admin, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_procurement_status ON orders(procurement_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);

CREATE TABLE order_returns_new (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_line_id TEXT NOT NULL,
    variant_id TEXT,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN (
        'requested',
        'received',
        'restocked',
        'cancelled'
    )),
    reason TEXT DEFAULT '',
    note TEXT DEFAULT '',
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (order_line_id) REFERENCES order_lines(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

INSERT INTO order_returns_new (
    id,
    order_id,
    order_line_id,
    variant_id,
    quantity,
    status,
    reason,
    note,
    created_by,
    created_at,
    updated_at
)
SELECT
    id,
    order_id,
    order_line_id,
    variant_id,
    quantity,
    CASE
        WHEN status = 'pending' THEN 'requested'
        ELSE status
    END,
    reason,
    note,
    created_by,
    created_at,
    updated_at
FROM order_returns;

DROP TABLE order_returns;
ALTER TABLE order_returns_new RENAME TO order_returns;

CREATE INDEX IF NOT EXISTS idx_order_returns_order_id ON order_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_order_line_id ON order_returns(order_line_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_variant_id ON order_returns(variant_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_status ON order_returns(status);
CREATE INDEX IF NOT EXISTS idx_order_returns_created_at ON order_returns(created_at DESC);

PRAGMA foreign_keys = ON;
