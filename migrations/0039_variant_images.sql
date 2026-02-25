-- Migration: 0039_variant_images.sql
-- Description: Add variant-specific image relation with single-primary integrity

CREATE TABLE IF NOT EXISTS variant_images (
    id TEXT PRIMARY KEY,
    variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    image_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(variant_id, image_id),
    UNIQUE(variant_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_variant_images_variant ON variant_images(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_images_image ON variant_images(image_id);
CREATE INDEX IF NOT EXISTS idx_variant_images_variant_sort ON variant_images(variant_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_images_single_primary
ON variant_images(variant_id)
WHERE is_primary = 1;

DROP TRIGGER IF EXISTS trg_variant_images_primary_insert_guard;
CREATE TRIGGER trg_variant_images_primary_insert_guard
BEFORE INSERT ON variant_images
FOR EACH ROW
WHEN NEW.is_primary = 1
BEGIN
  UPDATE variant_images
  SET is_primary = 0, updated_at = unixepoch()
  WHERE variant_id = NEW.variant_id
    AND is_primary = 1;
END;

DROP TRIGGER IF EXISTS trg_variant_images_primary_update_guard;
CREATE TRIGGER trg_variant_images_primary_update_guard
BEFORE UPDATE OF is_primary, variant_id ON variant_images
FOR EACH ROW
WHEN NEW.is_primary = 1
BEGIN
  UPDATE variant_images
  SET is_primary = 0, updated_at = unixepoch()
  WHERE variant_id = NEW.variant_id
    AND id <> NEW.id
    AND is_primary = 1;
END;

DROP TRIGGER IF EXISTS trg_variant_images_primary_repair_after_insert;
CREATE TRIGGER trg_variant_images_primary_repair_after_insert
AFTER INSERT ON variant_images
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM variant_images vi
  WHERE vi.variant_id = NEW.variant_id
    AND vi.is_primary = 1
)
BEGIN
  UPDATE variant_images
  SET is_primary = 1, updated_at = unixepoch()
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_variant_images_primary_repair_after_delete;
CREATE TRIGGER trg_variant_images_primary_repair_after_delete
AFTER DELETE ON variant_images
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM variant_images vi
  WHERE vi.variant_id = OLD.variant_id
    AND vi.is_primary = 1
)
BEGIN
  UPDATE variant_images
  SET is_primary = 1, updated_at = unixepoch()
  WHERE id = (
    SELECT vi.id
    FROM variant_images vi
    WHERE vi.variant_id = OLD.variant_id
    ORDER BY vi.sort_order ASC, vi.created_at ASC, vi.id ASC
    LIMIT 1
  );
END;

DROP TRIGGER IF EXISTS trg_variant_images_primary_repair_after_update;
CREATE TRIGGER trg_variant_images_primary_repair_after_update
AFTER UPDATE OF variant_id, is_primary ON variant_images
FOR EACH ROW
BEGIN
  UPDATE variant_images
  SET is_primary = 1, updated_at = unixepoch()
  WHERE id = (
    SELECT vi.id
    FROM variant_images vi
    WHERE vi.variant_id = OLD.variant_id
    ORDER BY vi.sort_order ASC, vi.created_at ASC, vi.id ASC
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1
    FROM variant_images vi
    WHERE vi.variant_id = OLD.variant_id
      AND vi.is_primary = 1
  );

  UPDATE variant_images
  SET is_primary = 1, updated_at = unixepoch()
  WHERE id = (
    SELECT vi.id
    FROM variant_images vi
    WHERE vi.variant_id = NEW.variant_id
    ORDER BY vi.sort_order ASC, vi.created_at ASC, vi.id ASC
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1
    FROM variant_images vi
    WHERE vi.variant_id = NEW.variant_id
      AND vi.is_primary = 1
  );
END;
