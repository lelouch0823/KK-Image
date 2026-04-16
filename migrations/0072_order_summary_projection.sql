-- Migration number: 0072   2026-04-16
-- Add order summary projection for hot order list and stats reads.

CREATE TABLE IF NOT EXISTS order_summary_projection (
  order_id TEXT PRIMARY KEY,
  snapshot_name TEXT,
  display_status TEXT,
  ordered_qty INTEGER NOT NULL DEFAULT 0,
  procured_qty INTEGER NOT NULL DEFAULT 0,
  received_qty INTEGER NOT NULL DEFAULT 0,
  shipped_qty INTEGER NOT NULL DEFAULT 0,
  returned_qty INTEGER NOT NULL DEFAULT 0,
  cancelled_qty INTEGER NOT NULL DEFAULT 0,
  effective_delivery_status TEXT NOT NULL DEFAULT 'not_shipped',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_summary_projection_display_status
  ON order_summary_projection(display_status);

CREATE INDEX IF NOT EXISTS idx_order_summary_projection_effective_delivery_status
  ON order_summary_projection(effective_delivery_status);

CREATE INDEX IF NOT EXISTS idx_order_summary_projection_updated_at
  ON order_summary_projection(updated_at DESC);

INSERT INTO order_summary_projection (
  order_id,
  snapshot_name,
  display_status,
  ordered_qty,
  procured_qty,
  received_qty,
  shipped_qty,
  returned_qty,
  cancelled_qty,
  effective_delivery_status,
  updated_at
)
SELECT
  o.id AS order_id,
  line_snapshot.snapshot_name AS snapshot_name,
  CASE
    WHEN line_agg.order_id IS NULL THEN NULL
    WHEN line_agg.ordered_qty > 0 AND line_agg.cancelled_qty >= line_agg.ordered_qty THEN 'cancelled'
    WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.shipped_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'completed'
    WHEN line_agg.shipped_qty > 0 THEN 'partially_shipped'
    WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.received_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'ready'
    WHEN line_agg.received_qty > 0 THEN 'partially_received'
    WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.procured_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'fully_procured'
    WHEN line_agg.procured_qty > 0 THEN 'partially_procured'
    ELSE 'unprocured'
  END AS display_status,
  COALESCE(line_agg.ordered_qty, 0) AS ordered_qty,
  COALESCE(line_agg.procured_qty, 0) AS procured_qty,
  COALESCE(line_agg.received_qty, 0) AS received_qty,
  COALESCE(line_agg.shipped_qty, 0) AS shipped_qty,
  COALESCE(return_agg.returned_qty, 0) AS returned_qty,
  COALESCE(line_agg.cancelled_qty, 0) AS cancelled_qty,
  CASE
    WHEN COALESCE(line_agg.shipped_qty, 0) > 0
      AND COALESCE(return_agg.returned_qty, 0) >= COALESCE(line_agg.shipped_qty, 0)
      AND COALESCE(return_agg.returned_qty, 0) > 0 THEN 'returned'
    WHEN COALESCE(return_agg.returned_qty, 0) > 0 THEN 'partially_returned'
    WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
      THEN LOWER(TRIM(o.delivery_status))
    WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
    WHEN COALESCE(line_agg.shipped_qty, 0) > 0 THEN 'in_transit'
    ELSE 'not_shipped'
  END AS effective_delivery_status,
  COALESCE(o.updated_at, o.created_at) AS updated_at
FROM orders o
LEFT JOIN (
  SELECT
    order_id,
    COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
    COALESCE(SUM(procured_qty), 0) AS procured_qty,
    COALESCE(SUM(received_qty), 0) AS received_qty,
    COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
    COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
  FROM order_lines
  GROUP BY order_id
) line_agg ON line_agg.order_id = o.id
LEFT JOIN (
  SELECT
    order_id,
    COALESCE(SUM(quantity), 0) AS returned_qty
  FROM order_returns
  WHERE status != 'cancelled'
  GROUP BY order_id
) return_agg ON return_agg.order_id = o.id
LEFT JOIN (
  SELECT ranked_lines.order_id, ranked_lines.snapshot_name
  FROM (
    SELECT
      order_id,
      snapshot_name,
      ROW_NUMBER() OVER (
        PARTITION BY order_id
        ORDER BY created_at ASC, id ASC
      ) AS row_num
    FROM order_lines
    WHERE COALESCE(snapshot_name, '') != ''
  ) ranked_lines
  WHERE ranked_lines.row_num = 1
) line_snapshot ON line_snapshot.order_id = o.id
ON CONFLICT(order_id) DO UPDATE SET
  snapshot_name = excluded.snapshot_name,
  display_status = excluded.display_status,
  ordered_qty = excluded.ordered_qty,
  procured_qty = excluded.procured_qty,
  received_qty = excluded.received_qty,
  shipped_qty = excluded.shipped_qty,
  returned_qty = excluded.returned_qty,
  cancelled_qty = excluded.cancelled_qty,
  effective_delivery_status = excluded.effective_delivery_status,
  updated_at = excluded.updated_at;

CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_orders_ai
AFTER INSERT ON orders
BEGIN
  DELETE FROM order_summary_projection WHERE order_id = NEW.id;
  INSERT INTO order_summary_projection (
    order_id, snapshot_name, display_status, ordered_qty, procured_qty, received_qty,
    shipped_qty, returned_qty, cancelled_qty, effective_delivery_status, updated_at
  )
  SELECT
    o.id,
    line_snapshot.snapshot_name,
    CASE
      WHEN line_agg.order_id IS NULL THEN NULL
      WHEN line_agg.ordered_qty > 0 AND line_agg.cancelled_qty >= line_agg.ordered_qty THEN 'cancelled'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.shipped_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'completed'
      WHEN line_agg.shipped_qty > 0 THEN 'partially_shipped'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.received_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'ready'
      WHEN line_agg.received_qty > 0 THEN 'partially_received'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.procured_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'fully_procured'
      WHEN line_agg.procured_qty > 0 THEN 'partially_procured'
      ELSE 'unprocured'
    END,
    COALESCE(line_agg.ordered_qty, 0),
    COALESCE(line_agg.procured_qty, 0),
    COALESCE(line_agg.received_qty, 0),
    COALESCE(line_agg.shipped_qty, 0),
    COALESCE(return_agg.returned_qty, 0),
    COALESCE(line_agg.cancelled_qty, 0),
    CASE
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0
        AND COALESCE(return_agg.returned_qty, 0) >= COALESCE(line_agg.shipped_qty, 0)
        AND COALESCE(return_agg.returned_qty, 0) > 0 THEN 'returned'
      WHEN COALESCE(return_agg.returned_qty, 0) > 0 THEN 'partially_returned'
      WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
        THEN LOWER(TRIM(o.delivery_status))
      WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0 THEN 'in_transit'
      ELSE 'not_shipped'
    END,
    COALESCE(o.updated_at, o.created_at)
  FROM orders o
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
      COALESCE(SUM(procured_qty), 0) AS procured_qty,
      COALESCE(SUM(received_qty), 0) AS received_qty,
      COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
      COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
    FROM order_lines
    WHERE order_id = NEW.id
    GROUP BY order_id
  ) line_agg ON line_agg.order_id = o.id
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(quantity), 0) AS returned_qty
    FROM order_returns
    WHERE status != 'cancelled' AND order_id = NEW.id
    GROUP BY order_id
  ) return_agg ON return_agg.order_id = o.id
  LEFT JOIN (
    SELECT ranked_lines.order_id, ranked_lines.snapshot_name
    FROM (
      SELECT
        order_id,
        snapshot_name,
        ROW_NUMBER() OVER (
          PARTITION BY order_id
          ORDER BY created_at ASC, id ASC
        ) AS row_num
      FROM order_lines
      WHERE order_id = NEW.id AND COALESCE(snapshot_name, '') != ''
    ) ranked_lines
    WHERE ranked_lines.row_num = 1
  ) line_snapshot ON line_snapshot.order_id = o.id
  WHERE o.id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_orders_au
AFTER UPDATE ON orders
BEGIN
  DELETE FROM order_summary_projection WHERE order_id = NEW.id;
  INSERT INTO order_summary_projection (
    order_id, snapshot_name, display_status, ordered_qty, procured_qty, received_qty,
    shipped_qty, returned_qty, cancelled_qty, effective_delivery_status, updated_at
  )
  SELECT
    o.id,
    line_snapshot.snapshot_name,
    CASE
      WHEN line_agg.order_id IS NULL THEN NULL
      WHEN line_agg.ordered_qty > 0 AND line_agg.cancelled_qty >= line_agg.ordered_qty THEN 'cancelled'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.shipped_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'completed'
      WHEN line_agg.shipped_qty > 0 THEN 'partially_shipped'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.received_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'ready'
      WHEN line_agg.received_qty > 0 THEN 'partially_received'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.procured_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'fully_procured'
      WHEN line_agg.procured_qty > 0 THEN 'partially_procured'
      ELSE 'unprocured'
    END,
    COALESCE(line_agg.ordered_qty, 0),
    COALESCE(line_agg.procured_qty, 0),
    COALESCE(line_agg.received_qty, 0),
    COALESCE(line_agg.shipped_qty, 0),
    COALESCE(return_agg.returned_qty, 0),
    COALESCE(line_agg.cancelled_qty, 0),
    CASE
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0
        AND COALESCE(return_agg.returned_qty, 0) >= COALESCE(line_agg.shipped_qty, 0)
        AND COALESCE(return_agg.returned_qty, 0) > 0 THEN 'returned'
      WHEN COALESCE(return_agg.returned_qty, 0) > 0 THEN 'partially_returned'
      WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
        THEN LOWER(TRIM(o.delivery_status))
      WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0 THEN 'in_transit'
      ELSE 'not_shipped'
    END,
    COALESCE(o.updated_at, o.created_at)
  FROM orders o
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
      COALESCE(SUM(procured_qty), 0) AS procured_qty,
      COALESCE(SUM(received_qty), 0) AS received_qty,
      COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
      COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
    FROM order_lines
    WHERE order_id = NEW.id
    GROUP BY order_id
  ) line_agg ON line_agg.order_id = o.id
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(quantity), 0) AS returned_qty
    FROM order_returns
    WHERE status != 'cancelled' AND order_id = NEW.id
    GROUP BY order_id
  ) return_agg ON return_agg.order_id = o.id
  LEFT JOIN (
    SELECT ranked_lines.order_id, ranked_lines.snapshot_name
    FROM (
      SELECT
        order_id,
        snapshot_name,
        ROW_NUMBER() OVER (
          PARTITION BY order_id
          ORDER BY created_at ASC, id ASC
        ) AS row_num
      FROM order_lines
      WHERE order_id = NEW.id AND COALESCE(snapshot_name, '') != ''
    ) ranked_lines
    WHERE ranked_lines.row_num = 1
  ) line_snapshot ON line_snapshot.order_id = o.id
  WHERE o.id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_lines_ai
AFTER INSERT ON order_lines
BEGIN
  DELETE FROM order_summary_projection WHERE order_id = NEW.order_id;
  INSERT INTO order_summary_projection (
    order_id, snapshot_name, display_status, ordered_qty, procured_qty, received_qty,
    shipped_qty, returned_qty, cancelled_qty, effective_delivery_status, updated_at
  )
  SELECT
    o.id,
    line_snapshot.snapshot_name,
    CASE
      WHEN line_agg.order_id IS NULL THEN NULL
      WHEN line_agg.ordered_qty > 0 AND line_agg.cancelled_qty >= line_agg.ordered_qty THEN 'cancelled'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.shipped_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'completed'
      WHEN line_agg.shipped_qty > 0 THEN 'partially_shipped'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.received_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'ready'
      WHEN line_agg.received_qty > 0 THEN 'partially_received'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.procured_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'fully_procured'
      WHEN line_agg.procured_qty > 0 THEN 'partially_procured'
      ELSE 'unprocured'
    END,
    COALESCE(line_agg.ordered_qty, 0),
    COALESCE(line_agg.procured_qty, 0),
    COALESCE(line_agg.received_qty, 0),
    COALESCE(line_agg.shipped_qty, 0),
    COALESCE(return_agg.returned_qty, 0),
    COALESCE(line_agg.cancelled_qty, 0),
    CASE
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0
        AND COALESCE(return_agg.returned_qty, 0) >= COALESCE(line_agg.shipped_qty, 0)
        AND COALESCE(return_agg.returned_qty, 0) > 0 THEN 'returned'
      WHEN COALESCE(return_agg.returned_qty, 0) > 0 THEN 'partially_returned'
      WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
        THEN LOWER(TRIM(o.delivery_status))
      WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0 THEN 'in_transit'
      ELSE 'not_shipped'
    END,
    COALESCE(o.updated_at, o.created_at)
  FROM orders o
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
      COALESCE(SUM(procured_qty), 0) AS procured_qty,
      COALESCE(SUM(received_qty), 0) AS received_qty,
      COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
      COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
    FROM order_lines
    WHERE order_id = NEW.order_id
    GROUP BY order_id
  ) line_agg ON line_agg.order_id = o.id
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(quantity), 0) AS returned_qty
    FROM order_returns
    WHERE status != 'cancelled' AND order_id = NEW.order_id
    GROUP BY order_id
  ) return_agg ON return_agg.order_id = o.id
  LEFT JOIN (
    SELECT ranked_lines.order_id, ranked_lines.snapshot_name
    FROM (
      SELECT
        order_id,
        snapshot_name,
        ROW_NUMBER() OVER (
          PARTITION BY order_id
          ORDER BY created_at ASC, id ASC
        ) AS row_num
      FROM order_lines
      WHERE order_id = NEW.order_id AND COALESCE(snapshot_name, '') != ''
    ) ranked_lines
    WHERE ranked_lines.row_num = 1
  ) line_snapshot ON line_snapshot.order_id = o.id
  WHERE o.id = NEW.order_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_lines_au
AFTER UPDATE ON order_lines
BEGIN
  DELETE FROM order_summary_projection WHERE order_id IN (OLD.order_id, NEW.order_id);
  INSERT INTO order_summary_projection (
    order_id, snapshot_name, display_status, ordered_qty, procured_qty, received_qty,
    shipped_qty, returned_qty, cancelled_qty, effective_delivery_status, updated_at
  )
  SELECT
    o.id,
    line_snapshot.snapshot_name,
    CASE
      WHEN line_agg.order_id IS NULL THEN NULL
      WHEN line_agg.ordered_qty > 0 AND line_agg.cancelled_qty >= line_agg.ordered_qty THEN 'cancelled'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.shipped_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'completed'
      WHEN line_agg.shipped_qty > 0 THEN 'partially_shipped'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.received_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'ready'
      WHEN line_agg.received_qty > 0 THEN 'partially_received'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.procured_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'fully_procured'
      WHEN line_agg.procured_qty > 0 THEN 'partially_procured'
      ELSE 'unprocured'
    END,
    COALESCE(line_agg.ordered_qty, 0),
    COALESCE(line_agg.procured_qty, 0),
    COALESCE(line_agg.received_qty, 0),
    COALESCE(line_agg.shipped_qty, 0),
    COALESCE(return_agg.returned_qty, 0),
    COALESCE(line_agg.cancelled_qty, 0),
    CASE
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0
        AND COALESCE(return_agg.returned_qty, 0) >= COALESCE(line_agg.shipped_qty, 0)
        AND COALESCE(return_agg.returned_qty, 0) > 0 THEN 'returned'
      WHEN COALESCE(return_agg.returned_qty, 0) > 0 THEN 'partially_returned'
      WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
        THEN LOWER(TRIM(o.delivery_status))
      WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0 THEN 'in_transit'
      ELSE 'not_shipped'
    END,
    COALESCE(o.updated_at, o.created_at)
  FROM orders o
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
      COALESCE(SUM(procured_qty), 0) AS procured_qty,
      COALESCE(SUM(received_qty), 0) AS received_qty,
      COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
      COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
    FROM order_lines
    WHERE order_id IN (OLD.order_id, NEW.order_id)
    GROUP BY order_id
  ) line_agg ON line_agg.order_id = o.id
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(quantity), 0) AS returned_qty
    FROM order_returns
    WHERE status != 'cancelled' AND order_id IN (OLD.order_id, NEW.order_id)
    GROUP BY order_id
  ) return_agg ON return_agg.order_id = o.id
  LEFT JOIN (
    SELECT ranked_lines.order_id, ranked_lines.snapshot_name
    FROM (
      SELECT
        order_id,
        snapshot_name,
        ROW_NUMBER() OVER (
          PARTITION BY order_id
          ORDER BY created_at ASC, id ASC
        ) AS row_num
      FROM order_lines
      WHERE order_id IN (OLD.order_id, NEW.order_id) AND COALESCE(snapshot_name, '') != ''
    ) ranked_lines
    WHERE ranked_lines.row_num = 1
  ) line_snapshot ON line_snapshot.order_id = o.id
  WHERE o.id IN (OLD.order_id, NEW.order_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_lines_ad
AFTER DELETE ON order_lines
BEGIN
  DELETE FROM order_summary_projection WHERE order_id = OLD.order_id;
  INSERT INTO order_summary_projection (
    order_id, snapshot_name, display_status, ordered_qty, procured_qty, received_qty,
    shipped_qty, returned_qty, cancelled_qty, effective_delivery_status, updated_at
  )
  SELECT
    o.id,
    line_snapshot.snapshot_name,
    CASE
      WHEN line_agg.order_id IS NULL THEN NULL
      WHEN line_agg.ordered_qty > 0 AND line_agg.cancelled_qty >= line_agg.ordered_qty THEN 'cancelled'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.shipped_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'completed'
      WHEN line_agg.shipped_qty > 0 THEN 'partially_shipped'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.received_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'ready'
      WHEN line_agg.received_qty > 0 THEN 'partially_received'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.procured_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'fully_procured'
      WHEN line_agg.procured_qty > 0 THEN 'partially_procured'
      ELSE 'unprocured'
    END,
    COALESCE(line_agg.ordered_qty, 0),
    COALESCE(line_agg.procured_qty, 0),
    COALESCE(line_agg.received_qty, 0),
    COALESCE(line_agg.shipped_qty, 0),
    COALESCE(return_agg.returned_qty, 0),
    COALESCE(line_agg.cancelled_qty, 0),
    CASE
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0
        AND COALESCE(return_agg.returned_qty, 0) >= COALESCE(line_agg.shipped_qty, 0)
        AND COALESCE(return_agg.returned_qty, 0) > 0 THEN 'returned'
      WHEN COALESCE(return_agg.returned_qty, 0) > 0 THEN 'partially_returned'
      WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
        THEN LOWER(TRIM(o.delivery_status))
      WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0 THEN 'in_transit'
      ELSE 'not_shipped'
    END,
    COALESCE(o.updated_at, o.created_at)
  FROM orders o
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
      COALESCE(SUM(procured_qty), 0) AS procured_qty,
      COALESCE(SUM(received_qty), 0) AS received_qty,
      COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
      COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
    FROM order_lines
    WHERE order_id = OLD.order_id
    GROUP BY order_id
  ) line_agg ON line_agg.order_id = o.id
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(quantity), 0) AS returned_qty
    FROM order_returns
    WHERE status != 'cancelled' AND order_id = OLD.order_id
    GROUP BY order_id
  ) return_agg ON return_agg.order_id = o.id
  LEFT JOIN (
    SELECT ranked_lines.order_id, ranked_lines.snapshot_name
    FROM (
      SELECT
        order_id,
        snapshot_name,
        ROW_NUMBER() OVER (
          PARTITION BY order_id
          ORDER BY created_at ASC, id ASC
        ) AS row_num
      FROM order_lines
      WHERE order_id = OLD.order_id AND COALESCE(snapshot_name, '') != ''
    ) ranked_lines
    WHERE ranked_lines.row_num = 1
  ) line_snapshot ON line_snapshot.order_id = o.id
  WHERE o.id = OLD.order_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_returns_ai
AFTER INSERT ON order_returns
BEGIN
  DELETE FROM order_summary_projection WHERE order_id = NEW.order_id;
  INSERT INTO order_summary_projection (
    order_id, snapshot_name, display_status, ordered_qty, procured_qty, received_qty,
    shipped_qty, returned_qty, cancelled_qty, effective_delivery_status, updated_at
  )
  SELECT
    o.id,
    line_snapshot.snapshot_name,
    CASE
      WHEN line_agg.order_id IS NULL THEN NULL
      WHEN line_agg.ordered_qty > 0 AND line_agg.cancelled_qty >= line_agg.ordered_qty THEN 'cancelled'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.shipped_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'completed'
      WHEN line_agg.shipped_qty > 0 THEN 'partially_shipped'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.received_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'ready'
      WHEN line_agg.received_qty > 0 THEN 'partially_received'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.procured_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'fully_procured'
      WHEN line_agg.procured_qty > 0 THEN 'partially_procured'
      ELSE 'unprocured'
    END,
    COALESCE(line_agg.ordered_qty, 0),
    COALESCE(line_agg.procured_qty, 0),
    COALESCE(line_agg.received_qty, 0),
    COALESCE(line_agg.shipped_qty, 0),
    COALESCE(return_agg.returned_qty, 0),
    COALESCE(line_agg.cancelled_qty, 0),
    CASE
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0
        AND COALESCE(return_agg.returned_qty, 0) >= COALESCE(line_agg.shipped_qty, 0)
        AND COALESCE(return_agg.returned_qty, 0) > 0 THEN 'returned'
      WHEN COALESCE(return_agg.returned_qty, 0) > 0 THEN 'partially_returned'
      WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
        THEN LOWER(TRIM(o.delivery_status))
      WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0 THEN 'in_transit'
      ELSE 'not_shipped'
    END,
    COALESCE(o.updated_at, o.created_at)
  FROM orders o
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
      COALESCE(SUM(procured_qty), 0) AS procured_qty,
      COALESCE(SUM(received_qty), 0) AS received_qty,
      COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
      COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
    FROM order_lines
    WHERE order_id = NEW.order_id
    GROUP BY order_id
  ) line_agg ON line_agg.order_id = o.id
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(quantity), 0) AS returned_qty
    FROM order_returns
    WHERE status != 'cancelled' AND order_id = NEW.order_id
    GROUP BY order_id
  ) return_agg ON return_agg.order_id = o.id
  LEFT JOIN (
    SELECT ranked_lines.order_id, ranked_lines.snapshot_name
    FROM (
      SELECT
        order_id,
        snapshot_name,
        ROW_NUMBER() OVER (
          PARTITION BY order_id
          ORDER BY created_at ASC, id ASC
        ) AS row_num
      FROM order_lines
      WHERE order_id = NEW.order_id AND COALESCE(snapshot_name, '') != ''
    ) ranked_lines
    WHERE ranked_lines.row_num = 1
  ) line_snapshot ON line_snapshot.order_id = o.id
  WHERE o.id = NEW.order_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_returns_au
AFTER UPDATE ON order_returns
BEGIN
  DELETE FROM order_summary_projection WHERE order_id IN (OLD.order_id, NEW.order_id);
  INSERT INTO order_summary_projection (
    order_id, snapshot_name, display_status, ordered_qty, procured_qty, received_qty,
    shipped_qty, returned_qty, cancelled_qty, effective_delivery_status, updated_at
  )
  SELECT
    o.id,
    line_snapshot.snapshot_name,
    CASE
      WHEN line_agg.order_id IS NULL THEN NULL
      WHEN line_agg.ordered_qty > 0 AND line_agg.cancelled_qty >= line_agg.ordered_qty THEN 'cancelled'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.shipped_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'completed'
      WHEN line_agg.shipped_qty > 0 THEN 'partially_shipped'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.received_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'ready'
      WHEN line_agg.received_qty > 0 THEN 'partially_received'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.procured_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'fully_procured'
      WHEN line_agg.procured_qty > 0 THEN 'partially_procured'
      ELSE 'unprocured'
    END,
    COALESCE(line_agg.ordered_qty, 0),
    COALESCE(line_agg.procured_qty, 0),
    COALESCE(line_agg.received_qty, 0),
    COALESCE(line_agg.shipped_qty, 0),
    COALESCE(return_agg.returned_qty, 0),
    COALESCE(line_agg.cancelled_qty, 0),
    CASE
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0
        AND COALESCE(return_agg.returned_qty, 0) >= COALESCE(line_agg.shipped_qty, 0)
        AND COALESCE(return_agg.returned_qty, 0) > 0 THEN 'returned'
      WHEN COALESCE(return_agg.returned_qty, 0) > 0 THEN 'partially_returned'
      WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
        THEN LOWER(TRIM(o.delivery_status))
      WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0 THEN 'in_transit'
      ELSE 'not_shipped'
    END,
    COALESCE(o.updated_at, o.created_at)
  FROM orders o
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
      COALESCE(SUM(procured_qty), 0) AS procured_qty,
      COALESCE(SUM(received_qty), 0) AS received_qty,
      COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
      COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
    FROM order_lines
    WHERE order_id IN (OLD.order_id, NEW.order_id)
    GROUP BY order_id
  ) line_agg ON line_agg.order_id = o.id
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(quantity), 0) AS returned_qty
    FROM order_returns
    WHERE status != 'cancelled' AND order_id IN (OLD.order_id, NEW.order_id)
    GROUP BY order_id
  ) return_agg ON return_agg.order_id = o.id
  LEFT JOIN (
    SELECT ranked_lines.order_id, ranked_lines.snapshot_name
    FROM (
      SELECT
        order_id,
        snapshot_name,
        ROW_NUMBER() OVER (
          PARTITION BY order_id
          ORDER BY created_at ASC, id ASC
        ) AS row_num
      FROM order_lines
      WHERE order_id IN (OLD.order_id, NEW.order_id) AND COALESCE(snapshot_name, '') != ''
    ) ranked_lines
    WHERE ranked_lines.row_num = 1
  ) line_snapshot ON line_snapshot.order_id = o.id
  WHERE o.id IN (OLD.order_id, NEW.order_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_returns_ad
AFTER DELETE ON order_returns
BEGIN
  DELETE FROM order_summary_projection WHERE order_id = OLD.order_id;
  INSERT INTO order_summary_projection (
    order_id, snapshot_name, display_status, ordered_qty, procured_qty, received_qty,
    shipped_qty, returned_qty, cancelled_qty, effective_delivery_status, updated_at
  )
  SELECT
    o.id,
    line_snapshot.snapshot_name,
    CASE
      WHEN line_agg.order_id IS NULL THEN NULL
      WHEN line_agg.ordered_qty > 0 AND line_agg.cancelled_qty >= line_agg.ordered_qty THEN 'cancelled'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.shipped_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'completed'
      WHEN line_agg.shipped_qty > 0 THEN 'partially_shipped'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.received_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'ready'
      WHEN line_agg.received_qty > 0 THEN 'partially_received'
      WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.procured_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'fully_procured'
      WHEN line_agg.procured_qty > 0 THEN 'partially_procured'
      ELSE 'unprocured'
    END,
    COALESCE(line_agg.ordered_qty, 0),
    COALESCE(line_agg.procured_qty, 0),
    COALESCE(line_agg.received_qty, 0),
    COALESCE(line_agg.shipped_qty, 0),
    COALESCE(return_agg.returned_qty, 0),
    COALESCE(line_agg.cancelled_qty, 0),
    CASE
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0
        AND COALESCE(return_agg.returned_qty, 0) >= COALESCE(line_agg.shipped_qty, 0)
        AND COALESCE(return_agg.returned_qty, 0) > 0 THEN 'returned'
      WHEN COALESCE(return_agg.returned_qty, 0) > 0 THEN 'partially_returned'
      WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
        THEN LOWER(TRIM(o.delivery_status))
      WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
      WHEN COALESCE(line_agg.shipped_qty, 0) > 0 THEN 'in_transit'
      ELSE 'not_shipped'
    END,
    COALESCE(o.updated_at, o.created_at)
  FROM orders o
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
      COALESCE(SUM(procured_qty), 0) AS procured_qty,
      COALESCE(SUM(received_qty), 0) AS received_qty,
      COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
      COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
    FROM order_lines
    WHERE order_id = OLD.order_id
    GROUP BY order_id
  ) line_agg ON line_agg.order_id = o.id
  LEFT JOIN (
    SELECT
      order_id,
      COALESCE(SUM(quantity), 0) AS returned_qty
    FROM order_returns
    WHERE status != 'cancelled' AND order_id = OLD.order_id
    GROUP BY order_id
  ) return_agg ON return_agg.order_id = o.id
  LEFT JOIN (
    SELECT ranked_lines.order_id, ranked_lines.snapshot_name
    FROM (
      SELECT
        order_id,
        snapshot_name,
        ROW_NUMBER() OVER (
          PARTITION BY order_id
          ORDER BY created_at ASC, id ASC
        ) AS row_num
      FROM order_lines
      WHERE order_id = OLD.order_id AND COALESCE(snapshot_name, '') != ''
    ) ranked_lines
    WHERE ranked_lines.row_num = 1
  ) line_snapshot ON line_snapshot.order_id = o.id
  WHERE o.id = OLD.order_id;
END;
