-- D1 数据库初始化迁移
-- 创建时间: 2024-12-26
-- 支持嵌套文件夹的文件管理系统

-- 文件夹表 (支持嵌套结构)
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  share_token TEXT UNIQUE,
  is_public INTEGER DEFAULT 0,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 文件表
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  folder_id TEXT,
  name TEXT NOT NULL,
  original_name TEXT,
  size INTEGER DEFAULT 0,
  mime_type TEXT,
  storage_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_share_token ON folders(share_token);
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);

-- 创建根文件夹（可选，用于存放未分类文件）
INSERT OR IGNORE INTO folders (id, parent_id, name, description, share_token, is_public, created_at, updated_at)
VALUES ('root', NULL, '根目录', '默认根目录', NULL, 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
