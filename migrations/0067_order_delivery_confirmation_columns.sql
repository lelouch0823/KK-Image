-- Migration number: 0067   2026-04-14
-- Add explicit delivery confirmation metadata to orders.

ALTER TABLE orders ADD COLUMN delivered_at INTEGER;
ALTER TABLE orders ADD COLUMN delivered_by TEXT;
ALTER TABLE orders ADD COLUMN delivery_note TEXT NOT NULL DEFAULT '';
