export function getTotalCreateQty(items: any[] = []): number {
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function getShortageItems(items: any[] = []): any[] {
  return items.filter((item) => item.required_quantity && item.quantity < item.required_quantity);
}

export function getCreateFlowSourceItems({ pickerTarget, detailItems = [], poItems = [] }: { pickerTarget?: string; detailItems?: any[]; poItems?: any[] } = {}): any[] {
  return pickerTarget === 'detail' ? detailItems : poItems;
}

export function getExcludeOrderIds(items: any[] = []): any[] {
  return items.filter((item) => item.pre_order_id).map((item) => item.pre_order_id);
}

export function getSelectedVariantIdsForPicker(items: any[] = []): string[] {
  return [
    ...new Set(
      items
        .filter((item) => !item.pre_order_id && item.variant_id)
        .map((item) => item.variant_id)
    ),
  ];
}

export function getExistingBrands(items: any[] = []): string[] {
  return [...new Set(items.map((item) => item.brand).filter(Boolean))];
}

export function buildCreatePurchaseItemsPayload(items: any[] = []): any[] {
  return items.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    pre_order_id: item.pre_order_id || null,
    quantity: item.quantity || 1,
    unit_cost: item.unit_cost || 0,
  }));
}
