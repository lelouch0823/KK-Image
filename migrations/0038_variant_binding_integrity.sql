-- Migration: 0038_variant_binding_integrity.sql
-- Description: Enforce strong product-variant binding integrity across business tables

-- 1) Backfill / cleanup historical inconsistent bindings
UPDATE orders
SET variant_id = NULL
WHERE variant_id IS NOT NULL
  AND (
    product_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM product_variants pv
      WHERE pv.id = orders.variant_id
        AND pv.product_id = orders.product_id
    )
  );
--> statement-breakpoint

UPDATE purchase_order_items
SET variant_id = NULL
WHERE variant_id IS NOT NULL
  AND (
    product_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM product_variants pv
      WHERE pv.id = purchase_order_items.variant_id
        AND pv.product_id = purchase_order_items.product_id
    )
  );
--> statement-breakpoint

UPDATE spaces
SET variant_id = NULL
WHERE variant_id IS NOT NULL
  AND (
    product_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM product_variants pv
      WHERE pv.id = spaces.variant_id
        AND pv.product_id = spaces.product_id
    )
  );
--> statement-breakpoint

-- 2) Add useful lookup index for integrity checks and joins
CREATE INDEX IF NOT EXISTS idx_variants_id_product ON product_variants(id, product_id);
--> statement-breakpoint

-- 3) Enforce at DB level via triggers
DROP TRIGGER IF EXISTS trg_orders_variant_binding_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_orders_variant_binding_update;
--> statement-breakpoint
CREATE TRIGGER trg_orders_variant_binding_insert
BEFORE INSERT ON orders
FOR EACH ROW
WHEN NEW.variant_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'orders.variant_id requires matching product_id')
  WHERE NEW.product_id IS NULL;

  SELECT RAISE(ABORT, 'orders.variant_id must belong to product_id')
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_variants pv
    WHERE pv.id = NEW.variant_id
      AND pv.product_id = NEW.product_id
  );
END;
--> statement-breakpoint

CREATE TRIGGER trg_orders_variant_binding_update
BEFORE UPDATE OF product_id, variant_id ON orders
FOR EACH ROW
WHEN NEW.variant_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'orders.variant_id requires matching product_id')
  WHERE NEW.product_id IS NULL;

  SELECT RAISE(ABORT, 'orders.variant_id must belong to product_id')
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_variants pv
    WHERE pv.id = NEW.variant_id
      AND pv.product_id = NEW.product_id
  );
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_poi_variant_binding_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_poi_variant_binding_update;
--> statement-breakpoint
CREATE TRIGGER trg_poi_variant_binding_insert
BEFORE INSERT ON purchase_order_items
FOR EACH ROW
WHEN NEW.variant_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'purchase_order_items.variant_id requires matching product_id')
  WHERE NEW.product_id IS NULL;

  SELECT RAISE(ABORT, 'purchase_order_items.variant_id must belong to product_id')
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_variants pv
    WHERE pv.id = NEW.variant_id
      AND pv.product_id = NEW.product_id
  );
END;
--> statement-breakpoint

CREATE TRIGGER trg_poi_variant_binding_update
BEFORE UPDATE OF product_id, variant_id ON purchase_order_items
FOR EACH ROW
WHEN NEW.variant_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'purchase_order_items.variant_id requires matching product_id')
  WHERE NEW.product_id IS NULL;

  SELECT RAISE(ABORT, 'purchase_order_items.variant_id must belong to product_id')
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_variants pv
    WHERE pv.id = NEW.variant_id
      AND pv.product_id = NEW.product_id
  );
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_spaces_variant_binding_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_spaces_variant_binding_update;
--> statement-breakpoint
CREATE TRIGGER trg_spaces_variant_binding_insert
BEFORE INSERT ON spaces
FOR EACH ROW
WHEN NEW.variant_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'spaces.variant_id requires matching product_id')
  WHERE NEW.product_id IS NULL;

  SELECT RAISE(ABORT, 'spaces.variant_id must belong to product_id')
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_variants pv
    WHERE pv.id = NEW.variant_id
      AND pv.product_id = NEW.product_id
  );
END;
--> statement-breakpoint

CREATE TRIGGER trg_spaces_variant_binding_update
BEFORE UPDATE OF product_id, variant_id ON spaces
FOR EACH ROW
WHEN NEW.variant_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'spaces.variant_id requires matching product_id')
  WHERE NEW.product_id IS NULL;

  SELECT RAISE(ABORT, 'spaces.variant_id must belong to product_id')
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_variants pv
    WHERE pv.id = NEW.variant_id
      AND pv.product_id = NEW.product_id
  );
END;
--> statement-breakpoint
