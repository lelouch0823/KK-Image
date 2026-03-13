-- Extend audit_logs into a unified operation audit ledger.
ALTER TABLE audit_logs ADD COLUMN actor_type TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN actor_id TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN actor_name TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN actor_role TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN source_app TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN request_id TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN trace_id TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN domain TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN result TEXT DEFAULT 'success';
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN severity TEXT DEFAULT 'normal';
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN target_label TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN summary TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN changes_json TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN metadata_json TEXT;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON audit_logs (created_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_audit_logs_domain_time
ON audit_logs (domain, created_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time
ON audit_logs (actor_id, created_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_audit_logs_result_severity_time
ON audit_logs (result, severity, created_at DESC);
