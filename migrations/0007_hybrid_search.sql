-- Migration number: 0007        2025-12-29T12:00:00Z
-- SOTA Hybrid Search: Add Generated Columns for JSON fields (Part 1: Product Basic)

-- 1. 为 spaces 表添加虚拟生成列 (Virtual Generated Columns)
ALTER TABLE spaces ADD COLUMN sku TEXT GENERATED ALWAYS AS (json_extract(template_data, '$.sku')) VIRTUAL;
ALTER TABLE spaces ADD COLUMN brand TEXT GENERATED ALWAYS AS (json_extract(template_data, '$.brand')) VIRTUAL;
ALTER TABLE spaces ADD COLUMN series TEXT GENERATED ALWAYS AS (json_extract(template_data, '$.series')) VIRTUAL;
ALTER TABLE spaces ADD COLUMN price REAL GENERATED ALWAYS AS (json_extract(template_data, '$.price')) VIRTUAL;

-- 2. 为虚拟列创建索引
CREATE INDEX IF NOT EXISTS idx_spaces_sku ON spaces(sku);
CREATE INDEX IF NOT EXISTS idx_spaces_brand ON spaces(brand);
CREATE INDEX IF NOT EXISTS idx_spaces_price ON spaces(price);
