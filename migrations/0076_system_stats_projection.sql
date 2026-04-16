-- Migration number: 0076   2026-04-16
-- Add cached system statistics projections for manage stats and dashboard reads.

CREATE TABLE IF NOT EXISTS system_stats_projection (
  scope TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_stats_projection_updated_at
  ON system_stats_projection(updated_at DESC);
