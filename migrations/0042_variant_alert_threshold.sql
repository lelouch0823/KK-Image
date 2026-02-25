-- Migration: 0042_variant_alert_threshold.sql
-- Description: move inventory alert threshold to product variant level

ALTER TABLE product_variants ADD COLUMN alert_threshold INTEGER DEFAULT 10;

UPDATE product_variants
SET alert_threshold = 10
WHERE alert_threshold IS NULL;
