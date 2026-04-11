-- Migration: 0062_command_idempotency_failed_status.sql
-- Description: Allow command_idempotency to persist recoverable failed commands.

DROP TABLE IF EXISTS command_idempotency_new;

CREATE TABLE command_idempotency_new (
  id TEXT PRIMARY KEY,
  command_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  response_json TEXT,
  status TEXT NOT NULL CHECK(status IN (
    'in_flight',
    'committed',
    'failed'
  )),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO command_idempotency_new (
  id,
  command_type,
  scope_key,
  idempotency_key,
  command_id,
  request_fingerprint,
  response_json,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  command_type,
  scope_key,
  idempotency_key,
  command_id,
  request_fingerprint,
  response_json,
  status,
  created_at,
  updated_at
FROM command_idempotency;

DROP TABLE command_idempotency;
ALTER TABLE command_idempotency_new RENAME TO command_idempotency;

CREATE UNIQUE INDEX IF NOT EXISTS idx_command_idempotency_scope_key
  ON command_idempotency(command_type, scope_key, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_command_idempotency_command_id
  ON command_idempotency(command_id);

CREATE INDEX IF NOT EXISTS idx_command_idempotency_status_updated_at
  ON command_idempotency(status, updated_at DESC);
