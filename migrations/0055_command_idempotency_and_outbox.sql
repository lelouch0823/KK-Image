-- Migration: 0055_command_idempotency_and_outbox.sql
-- Description: Add receipt command idempotency and durable outbox delivery tables.

CREATE TABLE IF NOT EXISTS command_idempotency (
  id TEXT PRIMARY KEY,
  command_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  response_json TEXT,
  status TEXT NOT NULL CHECK(status IN (
    'in_flight',
    'committed'
  )),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_command_idempotency_scope_key
  ON command_idempotency(command_type, scope_key, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_command_idempotency_command_id
  ON command_idempotency(command_id);

CREATE INDEX IF NOT EXISTS idx_command_idempotency_status_updated_at
  ON command_idempotency(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS domain_outbox (
  id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL,
  sequence_in_command INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  idempotency_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_outbox_idempotency_key
  ON domain_outbox(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_domain_outbox_command_sequence
  ON domain_outbox(command_id, sequence_in_command);

CREATE INDEX IF NOT EXISTS idx_domain_outbox_created_sequence
  ON domain_outbox(created_at, sequence_in_command, id);

CREATE INDEX IF NOT EXISTS idx_domain_outbox_aggregate_created
  ON domain_outbox(aggregate_type, aggregate_id, created_at);

CREATE TABLE IF NOT EXISTS outbox_consumer_jobs (
  id TEXT PRIMARY KEY,
  consumer_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN (
    'pending',
    'processing',
    'published',
    'failed'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL,
  leased_by TEXT,
  leased_until INTEGER,
  last_error TEXT,
  processed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES domain_outbox(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_consumer_jobs_consumer_event
  ON outbox_consumer_jobs(consumer_name, event_id);

CREATE INDEX IF NOT EXISTS idx_outbox_consumer_jobs_claim
  ON outbox_consumer_jobs(consumer_name, status, available_at);

CREATE INDEX IF NOT EXISTS idx_outbox_consumer_jobs_lease
  ON outbox_consumer_jobs(consumer_name, leased_until);
