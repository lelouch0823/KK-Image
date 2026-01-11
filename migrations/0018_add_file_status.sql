-- ===========================================================================
-- Migration: 0018_add_file_status.sql
-- Description: 为 files 表添加 status 字段，支持文件审核/收藏状态
-- Created: 2026-01-11
-- ===========================================================================

-- 添加状态字段
-- 枚举值:
--   'normal'     - 正常可见
--   'blocked'    - 已屏蔽/审核未通过
--   'whitelisted' - 白名单/免审核
--   'liked'      - 已收藏/标记
ALTER TABLE files ADD COLUMN status TEXT DEFAULT 'normal' 
    CHECK(status IN ('normal', 'blocked', 'whitelisted', 'liked'));

-- 创建索引以支持状态分组查询
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
