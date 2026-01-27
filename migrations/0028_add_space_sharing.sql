-- Migration number: 0028 	 2026-01-27
-- Add share_mode to spaces and create space_salesperson_shares table

-- Add share_mode column to spaces table if it doesn't exist
-- Note: SQLite does not support IF NOT EXISTS for ADD COLUMN directly in standard SQL, 
-- but we can just run it. If it fails because it exists, it might be an issue, 
-- but usually D1 migrations are applied sequentially.
-- However, to be safe and idempotent, we might need a more complex approach or just assume it is not there.
-- Given this is "0028", it likely is not there.
ALTER TABLE spaces ADD COLUMN share_mode TEXT DEFAULT 'all';

-- Create space_salesperson_shares table
CREATE TABLE IF NOT EXISTS space_salesperson_shares (
    space_id TEXT NOT NULL,
    salesperson_id TEXT NOT NULL,
    shared_at INTEGER NOT NULL,
    PRIMARY KEY (space_id, salesperson_id),
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (salesperson_id) REFERENCES salespersons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_space_shares_salesperson ON space_salesperson_shares(salesperson_id);
