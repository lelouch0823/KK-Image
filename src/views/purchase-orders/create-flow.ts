interface PurchaseOrderItem {
  product_id?: string;
  variant_id?: string;
  pre_order_id?: string | null;
  quantity?: number;
  unit_cost?: number;
  required_quantity?: number;
  brand?: string;
}

export function getTotalCreateQty(items: PurchaseOrderItem[] = []): number {
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function getShortageItems(items: PurchaseOrderItem[] = []): PurchaseOrderItem[] {
  return items.filter((item) => item.required_quantity && (item.quantity || 0) < item.required_quantity);
}

export function getCreateFlowSourceItems({ pickerTarget, detailItems = [], poItems = [] }: { pickerTarget?: string; detailItems?: PurchaseOrderItem[]; poItems?: PurchaseOrderItem[] } = {}): PurchaseOrderItem[] {
  return pickerTarget === 'detail' ? detailItems : poItems;
}

export function getExcludeOrderIds(items: PurchaseOrderItem[] = []): string[] {
  return items.filter((item) => item.pre_order_id).map((item) => item.pre_order_id as string);
}

export function getSelectedVariantIdsForPicker(items: PurchaseOrderItem[] = []): string[] {
  return [
    ...new Set(
      items
        .filter((item) => !item.pre_order_id && item.variant_id)
        .map((item) => item.variant_id as string)
    ),
  ];
}

export function getExistingBrands(items: PurchaseOrderItem[] = []): string[] {
  return [...new Set(items.map((item) => item.brand).filter(Boolean))] as string[];
}

export function buildCreatePurchaseItemsPayload(items: PurchaseOrderItem[] = []): Record<string, unknown>[] {
  return items.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    pre_order_id: item.pre_order_id || null,
    quantity: item.quantity || 1,
    unit_cost: item.unit_cost || 0,
  }));
}
