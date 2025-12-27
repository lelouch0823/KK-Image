-- D1 数据库迁移：共享空间模块
-- 创建时间: 2024-12-27
-- 支持模版化的共享空间系统

-- 空间表
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  parent_id TEXT,                    -- 父空间ID（支持嵌套）
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  template TEXT DEFAULT 'gallery',   -- 模版类型: gallery, product, portfolio, document, custom
  template_data TEXT,                -- JSON 模版数据（字段配置等）
  cover_file_id TEXT,                -- 封面文件引用
  share_token TEXT UNIQUE,
  is_public INTEGER DEFAULT 0,
  password TEXT,
  expires_at INTEGER,                -- 过期时间
  view_count INTEGER DEFAULT 0,      -- 访问统计
  download_count INTEGER DEFAULT 0,  -- 下载统计
  sort_order INTEGER DEFAULT 0,      -- 排序
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (cover_file_id) REFERENCES files(id) ON DELETE SET NULL
);

-- 空间与文件的多对多关系表
CREATE TABLE IF NOT EXISTS space_files (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  section TEXT DEFAULT 'default',    -- 所属区块（如 mainImages, attachments）
  sort_order INTEGER DEFAULT 0,      -- 文件在空间中的排序
  added_at INTEGER NOT NULL,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(space_id, file_id)          -- 防止重复添加
);

-- 访问日志表
CREATE TABLE IF NOT EXISTS space_access_logs (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  accessed_at INTEGER NOT NULL,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_spaces_parent ON spaces(parent_id);
CREATE INDEX IF NOT EXISTS idx_spaces_share_token ON spaces(share_token);
CREATE INDEX IF NOT EXISTS idx_spaces_template ON spaces(template);
CREATE INDEX IF NOT EXISTS idx_space_files_space ON space_files(space_id);
CREATE INDEX IF NOT EXISTS idx_space_files_file ON space_files(file_id);
CREATE INDEX IF NOT EXISTS idx_space_access_logs_space ON space_access_logs(space_id);
CREATE INDEX IF NOT EXISTS idx_space_access_logs_time ON space_access_logs(accessed_at DESC);
