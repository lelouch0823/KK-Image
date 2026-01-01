-- Migration: Add original_hash column for cross-device/browser deduplication
-- This enables deduplication based on original file hash before compression

ALTER TABLE files ADD COLUMN original_hash TEXT;

-- Index for fast lookup during pre-check
CREATE INDEX idx_files_original_hash ON files(original_hash);
