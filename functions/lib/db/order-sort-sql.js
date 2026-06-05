/**
 * 订单排序 SQL 常量
 *
 * 统一订单列表查询中重复出现的 status_priority CASE 表达式。
 */

/**
 * 订单状态优先级 CASE 表达式
 * 用于列表排序：pending > production > shipping > confirmed > arrived > fulfilled/delivered > rejected > void
 */
export const ORDER_STATUS_PRIORITY_CASE = `CASE o.status
    WHEN 'pending' THEN 1
    WHEN 'production' THEN 2
    WHEN 'shipping' THEN 3
    WHEN 'confirmed' THEN 4
    WHEN 'arrived' THEN 5
    WHEN 'fulfilled' THEN 6
    WHEN 'delivered' THEN 6
    WHEN 'rejected' THEN 7
    WHEN 'void' THEN 99
    ELSE 50
END`;
