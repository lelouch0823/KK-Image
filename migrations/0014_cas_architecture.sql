-- CAS (Content-Addressable Storage) 架构迁移
-- 创建时间: 2024-12-31
-- 用于图片去重和秒传功能

-- Blobs 表 (物理存储，哈希去重)
CREATE TABLE IF NOT EXISTS blobs (
    content_hash TEXT PRIMARY KEY,  -- SHA-256, also R2 key
    size INTEGER NOT NULL,
    mime_type TEXT,
    ref_count INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
);

-- 索引：用于清理零引用的 blob
CREATE INDEX IF NOT EXISTS idx_blobs_ref_count ON blobs(ref_count);

-- Files 表添加 content_hash 列
ALTER TABLE files ADD COLUMN content_hash TEXT;

-- 索引：用于通过哈希查找文件
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);
