/** 采购订单行项目 (协调结果输出) */
export interface PurchaseOrderItem {
  id?: string;
  pre_order_id: string | null;
  variant_id: string | null;
  product_id: string | null;
  quantity: number;
  unit_cost: number;
  product_name: string;
  sku: string;
  brand: string;
  image: string | null;
  moq: number | null;
  pack_size: number | null;
  order_step: number | null;
  required_quantity: number | null;
  order_no: string;
  [key: string]: unknown;
}

/** 产品变体 (用于选择) */
export interface ProductVariant {
  variant_id?: string;
  product_id?: string;
  unit_cost?: number;
  product_name?: string;
  sku?: string;
  brand?: string;
  image?: string | null;
  moq?: number | null;
  pack_size?: number | null;
  order_step?: string | number | null;
  [key: string]: unknown;
}

/** 变体选择协调结果 */
export interface VariantSelectionReconciliation {
  toAdd: PurchaseOrderItem[];
  toRemoveVariantIds: string[];
  toRemoveItemIds: string[];
}

/** 行项目输入 (兼容各种来源的行项目数据) */
interface ItemInput {
  id?: string;
  pre_order_id?: string | null;
  variant_id?: string | null;
}

export function reconcileVariantSelection({ currentItems = [], selectedVariants = [], selectedVariantIds = [] }: { currentItems?: ItemInput[]; selectedVariants?: ProductVariant[]; selectedVariantIds?: string[] } = {}): VariantSelectionReconciliation {
  const manualItems = (currentItems || []).filter((item) => !item.pre_order_id && item.variant_id);
  const selectedIdSet = new Set<string>(
    ((selectedVariantIds && selectedVariantIds.length > 0)
      ? selectedVariantIds
      : (selectedVariants || []).map((variant) => variant?.variant_id))
      .filter(Boolean) as string[]
  );
  const selectedByVariantId = new Map<string, ProductVariant>(
    (selectedVariants || [])
      .filter((variant) => variant?.variant_id)
      .map((variant) => [variant.variant_id!, variant])
  );

  const toRemove = manualItems.filter((item) => !selectedIdSet.has(item.variant_id!));
  const toRemoveVariantIds = toRemove.map((item) => item.variant_id).filter(Boolean) as string[];
  const toRemoveItemIds = toRemove.map((item) => item.id).filter(Boolean) as string[];

  const manualVariantIds = new Set(manualItems.map((item) => item.variant_id));
  const toAdd: PurchaseOrderItem[] = Array.from(selectedByVariantId.values())
    .filter((variant) => !manualVariantIds.has(variant.variant_id))
    .map((variant) => ({
      product_id: variant.product_id || null,
      variant_id: variant.variant_id || null,
      pre_order_id: null,
      quantity: 1,
      unit_cost: Number(variant.unit_cost || 0),
      product_name: variant.product_name || '—',
      sku: variant.sku || '—',
      brand: variant.brand || '',
      image: variant.image || null,
      moq: variant.moq || null,
      pack_size: variant.pack_size || null,
      order_step: variant.order_step != null ? Number(variant.order_step) || 0 : null,
      required_quantity: null,
      order_no: '',
    }));

  return {
    toAdd,
    toRemoveVariantIds,
    toRemoveItemIds,
  };
}

export function countUnavailableSelectedVariants(initialSelectedVariantIds: string[] = [], activeVariants: ProductVariant[] = []): number {
  const activeIds = new Set((activeVariants || []).map((variant) => variant.variant_id).filter(Boolean));
  return (initialSelectedVariantIds || []).filter((id) => id && !activeIds.has(id)).length;
}
