-- Migration: 0025_migrate_root_files.sql
-- Purpose: Move files from root to _System/Products

-- 1. Create _System folder if not exists
INSERT OR IGNORE INTO folders (id, parent_id, name, created_at, updated_at, is_system)
VALUES ('sys_root', NULL, '_System', 1735689600000, 1735689600000, 1);

-- 2. Create Products folder if not exists
INSERT OR IGNORE INTO folders (id, parent_id, name, created_at, updated_at, is_system)
VALUES ('sys_products', 'sys_root', 'Products', 1735689600000, 1735689600000, 1);

-- 3. Update files (Move from root to Products)
-- Assuming all root files are product images for now as per user context
UPDATE files 
SET folder_id = 'sys_products' 
WHERE folder_id = 'root' OR folder_id IS NULL;
