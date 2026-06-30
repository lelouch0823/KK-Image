/**
 * 商品展示相关工具函数
 *
 * 用于 ProductGrid、ProductTable 等商品列表/网格组件。
 */

/**
 * 解析商品的展示库存数量
 * 优先取 available_quantity，其次 available，最后 stock_quantity
 */
export function resolveDisplayStock(product: Record<string, unknown> | null | undefined): number {
  return Number(product?.available_quantity ?? product?.available ?? product?.stock_quantity ?? 0);
}

/**
 * 解析商品的库存预警阈值
 * 如果未设置或非数字，默认返回 10
 */
export function resolveAlertThreshold(product: Record<string, unknown> | null | undefined): number {
  const numeric = Number(product?.alert_threshold);
  return Number.isFinite(numeric) ? numeric : 10;
}
