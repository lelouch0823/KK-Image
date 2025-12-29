-- Migration number: 0008        2025-12-29T12:05:00Z
-- SOTA Hybrid Search: Add Extended Generated Columns

-- 1. Additional Product Fields
ALTER TABLE spaces ADD COLUMN material TEXT GENERATED ALWAYS AS (json_extract(template_data, '$.material')) VIRTUAL;

-- 2. General/Other Template Fields (Gallery, Portfolio, Document)
ALTER TABLE spaces ADD COLUMN category TEXT GENERATED ALWAYS AS (json_extract(template_data, '$.category')) VIRTUAL;
ALTER TABLE spaces ADD COLUMN author TEXT GENERATED ALWAYS AS (json_extract(template_data, '$.author')) VIRTUAL;
ALTER TABLE spaces ADD COLUMN tags TEXT GENERATED ALWAYS AS (json_extract(template_data, '$.tags')) VIRTUAL;

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_spaces_category ON spaces(category);
CREATE INDEX IF NOT EXISTS idx_spaces_author ON spaces(author);
CREATE INDEX IF NOT EXISTS idx_spaces_tags ON spaces(tags);
