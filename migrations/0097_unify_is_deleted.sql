-- 统一 is_deleted 字段，确保无 NULL 值
-- 此迁移将历史数据中 is_deleted 为 NULL 的行更新为 0，以便代码统一使用 WHERE is_deleted = 0
UPDATE files SET is_deleted = 0 WHERE is_deleted IS NULL;
UPDATE folders SET is_deleted = 0 WHERE is_deleted IS NULL;
