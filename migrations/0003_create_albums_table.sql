-- 创建相册相关表
-- 创建时间: 2024-12-28

-- 相册表
CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  share_token TEXT UNIQUE,
  is_public INTEGER DEFAULT 0,
  cover_file_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (cover_file_id) REFERENCES files(id) ON DELETE SET NULL
);

-- 相册-文件关联表
CREATE TABLE IF NOT EXISTS album_files (
  album_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (album_id, file_id),
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_albums_share_token ON albums(share_token);
CREATE INDEX IF NOT EXISTS idx_album_files_album ON album_files(album_id);
CREATE INDEX IF NOT EXISTS idx_album_files_file ON album_files(file_id);
