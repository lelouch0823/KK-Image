-- Migration number: 0030 	 2026-01-29T10:00:00Z
-- Optimize dashboard stats query
-- 优化仪表盘统计查询性能

CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
