-- Migration number: 0017 	 2026-01-10T15:30:00Z
-- Create api_keys table

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key_value TEXT NOT NULL UNIQUE, -- Renamed from 'key' to avoid keyword conflict
    name TEXT,
    permissions TEXT, -- JSON array string
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    disabled INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_api_keys_value ON api_keys(key_value);
