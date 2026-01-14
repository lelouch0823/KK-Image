-- ===========================================================================
-- Migration: Add Space Sharing to Salespersons
-- Version: 2026-01-14
-- Description: Adds share_mode column to spaces and creates junction table
--              for selective sharing with specific salespeople
-- ===========================================================================

-- 1. Add share_mode column to spaces table
-- Values: 'none' (private), 'all' (all salespeople), 'selected' (specific salespeople)
ALTER TABLE spaces ADD COLUMN share_mode TEXT DEFAULT 'none' 
    CHECK(share_mode IN ('none', 'all', 'selected'));

-- 2. Create junction table for selective sharing
CREATE TABLE IF NOT EXISTS space_salesperson_shares (
    space_id TEXT NOT NULL,
    salesperson_id TEXT NOT NULL,
    shared_at INTEGER NOT NULL,
    PRIMARY KEY (space_id, salesperson_id),
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (salesperson_id) REFERENCES salespersons(id) ON DELETE CASCADE
);

-- 3. Index for efficient salesperson lookup
CREATE INDEX IF NOT EXISTS idx_space_shares_salesperson ON space_salesperson_shares(salesperson_id);

-- 4. Cleanup: ensure existing public spaces get appropriate share_mode
-- (Optional: run this only if you want existing is_public=1 spaces to be visible to all)
-- UPDATE spaces SET share_mode = 'all' WHERE is_public = 1;
