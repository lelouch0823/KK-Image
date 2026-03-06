-- 0034_advanced_optimizations.sql
-- Part 1: Tags and FTS5 (Advanced Search)
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT,
    created_at INTEGER NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS file_tags (
    file_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (file_id, tag_id),
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
--> statement-breakpoint

-- Full Text Search virtual table for files
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
    name,
    content='files',
    content_rowid='rowid'
);
--> statement-breakpoint

-- Triggers to keep FTS index synced with files
CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
  INSERT INTO files_fts(rowid, name) VALUES (new.rowid, new.name);
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, name) VALUES('delete', old.rowid, old.name);
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, name) VALUES('delete', old.rowid, old.name);
  INSERT INTO files_fts(rowid, name) VALUES (new.rowid, new.name);
END;
--> statement-breakpoint

-- Populate existing files into FTS (Only needs to run once)
INSERT INTO files_fts(rowid, name) 
SELECT rowid, name FROM files 
WHERE rowid NOT IN (SELECT rowid FROM files_fts);
--> statement-breakpoint

-- Part 2: Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL, -- e.g., 'files:delete', 'order:create'
    target_type TEXT NOT NULL, -- e.g., 'file', 'order', 'user'
    target_id TEXT,
    payload TEXT, -- JSON string of changes
    ip_address TEXT,
    created_at INTEGER NOT NULL
);
--> statement-breakpoint

-- Index for querying audit logs by entity or user efficiently
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
