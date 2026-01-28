-- Migration number: 0029 	 2026-01-28
-- Add plain_password to salespersons for viewable password

ALTER TABLE salespersons ADD COLUMN plain_password TEXT;
