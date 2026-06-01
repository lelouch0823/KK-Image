-- Migration 0082: 性能优化索引
-- 解决关联子查询、复合查询、未读计数等性能瓶颈

-- 1. space_salesperson_shares 复合索引
-- 解决 SpaceRepository.findSubspacesForSalesperson() 的 EXISTS 子查询性能问题
-- 当前只有 (space_id) 单列索引，添加 (space_id, salesperson_id) 覆盖索引
CREATE INDEX IF NOT EXISTS idx_space_shares_space_salesperson
    ON space_salesperson_shares(space_id, salesperson_id);

-- 2. variant_images 覆盖 is_primary 条件
-- 解决 SpaceRepository._variantImageProjectionSQL() 的相关子查询性能问题
-- 当前 (variant_id, sort_order) 不包含 is_primary，需要回表过滤
CREATE INDEX IF NOT EXISTS idx_variant_images_primary
    ON variant_images(variant_id, is_primary, sort_order);

-- 3. 通知表优化未读计数
-- 解决 NotificationRepository 的未读 COUNT(*) 查询性能问题
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_read_created
    ON notifications(receiver, is_read, created_at DESC);

-- 4. product_variants status + product_id 复合索引
-- 优化 _variantAggregateCTE() 中 WHERE status = 'active' 的过滤效率
CREATE INDEX IF NOT EXISTS idx_product_variants_status_product
    ON product_variants(status, product_id);

-- 5. 更新统计信息以优化查询计划
PRAGMA optimize;
