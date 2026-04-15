export function getTotalCreateQty(items = []) {
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function getShortageItems(items = []) {
  return items.filter((item) => item.required_quantity && item.quantity < item.required_quantity);
}

export function getCreateFlowSourceItems({ pickerTarget, detailItems = [], poItems = [] } = {}) {
  return pickerTarget === 'detail' ? detailItems : poItems;
}

export function getExcludeOrderIds(items = []) {
  return items.filter((item) => item.pre_order_id).map((item) => item.pre_order_id);
}

export function getSelectedVariantIdsForPicker(items = []) {
  return [
    ...new Set(
      items
        .filter((item) => !item.pre_order_id && item.variant_id)
        .map((item) => item.variant_id)
    ),
  ];
}

export function getExistingBrands(items = []) {
  return [...new Set(items.map((item) => item.brand).filter(Boolean))];
}

export function buildCreatePurchaseItemsPayload(items = []) {
  return items.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    pre_order_id: item.pre_order_id || null,
    quantity: item.quantity || 1,
    unit_cost: item.unit_cost || 0,
  }));
}
