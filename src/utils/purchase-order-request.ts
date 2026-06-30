export function appendPurchaseOrderCacheBust(
  url: string,
  { forceRefresh = false, now = () => Date.now() }: { forceRefresh?: boolean; now?: () => number } = {}
): string {
  if (!forceRefresh) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_ts=${now()}`;
}

export function buildPurchaseOrderIdempotentJsonHeaders(
  {
    createId = () =>
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }: { createId?: () => string } = {}
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Idempotency-Key': createId(),
  };
}

/** 从建议单中提取关联的订单 ID 列表（去重） */
export function getSuggestionOrderIds(suggestion: Record<string, unknown> = {}): string[] {
  const orderIds = Array.isArray(suggestion.order_ids) ? suggestion.order_ids : [];
  return [...new Set(orderIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

// ── 采购单创建流程工具函数 ──

export interface PurchaseOrderItem {
  product_id?: string;
  variant_id?: string;
  pre_order_id?: string | null;
  quantity?: number;
  unit_cost?: number;
  required_quantity?: number;
  brand?: string;
}

/** 计算创建流程中所有条目的总数量 */
export function getTotalCreateQty(items: PurchaseOrderItem[] = []): number {
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

/** 筛选出缺货条目（需求量 > 已分配量） */
export function getShortageItems(items: PurchaseOrderItem[] = []): PurchaseOrderItem[] {
  return items.filter((item) => item.required_quantity && (item.quantity || 0) < item.required_quantity);
}

/** 根据 pickerTarget 获取创建流程的源条目 */
export function getCreateFlowSourceItems({ pickerTarget, detailItems = [], poItems = [] }: { pickerTarget?: string; detailItems?: PurchaseOrderItem[]; poItems?: PurchaseOrderItem[] } = {}): PurchaseOrderItem[] {
  return pickerTarget === 'detail' ? detailItems : poItems;
}

/** 提取已有预订单 ID（用于排除） */
export function getExcludeOrderIds(items: PurchaseOrderItem[] = []): string[] {
  return items.filter((item) => item.pre_order_id).map((item) => item.pre_order_id as string);
}

/** 提取已选变体 ID（用于选择器去重） */
export function getSelectedVariantIdsForPicker(items: PurchaseOrderItem[] = []): string[] {
  return [
    ...new Set(
      items
        .filter((item) => !item.pre_order_id && item.variant_id)
        .map((item) => item.variant_id as string)
    ),
  ];
}

/** 提取已有品牌列表 */
export function getExistingBrands(items: PurchaseOrderItem[] = []): string[] {
  return [...new Set(items.map((item) => item.brand).filter(Boolean))] as string[];
}

/** 构建创建采购单的提交载荷 */
export function buildCreatePurchaseItemsPayload(items: PurchaseOrderItem[] = []): Record<string, unknown>[] {
  return items.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    pre_order_id: item.pre_order_id || null,
    quantity: item.quantity || 1,
    unit_cost: item.unit_cost || 0,
  }));
}
