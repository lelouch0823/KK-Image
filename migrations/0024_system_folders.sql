-- Migration number: 0024 	 2026-01-26T21:00:00Z
-- Schema: Add system folder support and concurrency protection

-- 1. 唯一性约束：防止并发创建同名文件夹
-- 注意：SQLite 中 NULL 不参与唯一性约束，所以使用 COALESCE 处理 parent_id 为 NULL 的情况
-- 但 folders 表 parent_id 允许 NULL。
-- 正确的做法是创建部分索引或者虚拟列。
-- 或者简单起见，利用 D1/Node.js 层处理，但在 DB 层加约束更安全。
-- 这里的 unique index 需要小心 parent_id = NULL。
-- SQLite 3.39+ 支持 NULLs NOT DISTINCT，但 Cloudflare D1 版本未知。
-- 稳妥方案：只针对 parent_id IS NOT NULL 建立唯一索引，根目录单独处理或接受 app 层控制。
-- 或者，使用 text 'root' 代替 NULL (Folders current schema: parent_id TEXT)
-- 检查现有数据：Folders parent_id 是 NULL 还是 'root'?
-- FolderRepository.js line 32: WHERE (f.parent_id IS NULL OR f.parent_id = 'root')
-- 这意味着混用了。
-- 让我们先统一在应用层，DB 层加个普通索引即可，或者 strict unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_parent_name
ON folders(ifnull(parent_id, 'root'), name);

-- 2. 添加系统文件夹标记
ALTER TABLE folders ADD COLUMN is_system INTEGER DEFAULT 0;

-- 3. （可选）预创建系统文件夹 - 实际由 App 层 Lazy Create 更灵活，SQL 只做 Schema
