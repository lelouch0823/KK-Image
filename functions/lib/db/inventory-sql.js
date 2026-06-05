/**
 * 库存查询 SQL 常量
 *
 * 统一各 Repository 中重复出现的 COALESCE 表达式，
 * 避免改一处漏十处。
 */

/** on_hand 取值：优先 inventory_balances.on_hand，回退 product_variants.stock_quantity */
export const ON_HAND_EXPR = 'COALESCE(ib.on_hand, pv.stock_quantity, 0)';

/** available 取值：优先 inventory_balances.available，回退 ON_HAND_EXPR */
export const AVAILABLE_EXPR = 'COALESCE(ib.available, COALESCE(ib.on_hand, pv.stock_quantity, 0))';

/** inventory_balances 关联子句 */
export const INVENTORY_JOIN = 'LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id';
