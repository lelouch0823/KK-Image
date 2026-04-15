-- Migration number: 0070   2026-04-15
-- Backfill missing share_mode column for spaces.

ALTER TABLE spaces ADD COLUMN share_mode TEXT DEFAULT 'none';
