-- Migration number: 0032 	 2026-02-19T00:00:00.000Z

-- Add is_deleted and deleted_at to files
ALTER TABLE files ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE files ADD COLUMN deleted_at INTEGER;

-- Add is_deleted and deleted_at to folders
-- Note: folders table did not have status, but we will use is_deleted for consistency
ALTER TABLE folders ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE folders ADD COLUMN deleted_at INTEGER;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_folders_is_deleted ON folders(is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);
