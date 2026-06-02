-- 商品生命周期状态管理
-- 本迁移为 no-op：status 列已由迁移 0021_add_products.sql 添加
-- （定义：status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'draft'))）
-- 该定义已包含本迁移所需的所有约束，无需重复添加
-- SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS，强行执行会报 "duplicate column name" 错误

SELECT 1;
