-- Migration number: 0031 	 2026-01-30T12:00:00Z
-- Add login tracking for salespersons
-- 增加销售人员登录记录

ALTER TABLE salespersons ADD COLUMN last_login_at INTEGER;
ALTER TABLE salespersons ADD COLUMN last_login_ip TEXT;
ALTER TABLE salespersons ADD COLUMN last_login_device TEXT;
