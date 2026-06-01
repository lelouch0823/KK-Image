-- 商品生命周期状态管理
-- 添加 status 字段到 products 表
-- 现有商品默认为 'active'（上架状态）
-- 新建商品默认为 'draft'（草稿状态）
-- 有效值: draft（草稿）, active（上架）, archived（归档）

ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
