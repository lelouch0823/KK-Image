-- Migration number: 0006 	 2025-12-28T21:00:00Z
-- Optimize schema: Add ownership to folders, missing indexes, and media metadata

-- 1. 补全 Folders 所有权
ALTER TABLE folders ADD COLUMN created_by TEXT;

-- 2. 补全图片元数据 (SOTA: 防布局偏移与模糊加载)
ALTER TABLE files ADD COLUMN width INTEGER;
ALTER TABLE files ADD COLUMN height INTEGER;
ALTER TABLE files ADD COLUMN blurhash TEXT;

-- 3. 补充性能索引
-- 文件夹按创建者查询
CREATE INDEX IF NOT EXISTS idx_folders_created_by ON folders(created_by);

-- 文件按创建者查询
CREATE INDEX IF NOT EXISTS idx_files_created_by ON files(created_by);

-- 外键索引 (SQLite 不会自动创建，删除父项时必须索引以避免全表扫描)
CREATE INDEX IF NOT EXISTS idx_albums_cover ON albums(cover_file_id);
CREATE INDEX IF NOT EXISTS idx_spaces_cover ON spaces(cover_file_id);
