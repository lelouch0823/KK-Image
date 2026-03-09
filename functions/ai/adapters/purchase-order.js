export const purchaseOrderActionAdapter = {
  entityType: 'purchase_order',
  actionType: 'create_purchase_order',
  targetModule: 'purchaseOrders',
  requiredSlots: ['mode'],
  optionalSlots: ['items', 'order_ids', 'remark', 'currency', 'allocation_method', 'estimated_shipping_cost', 'estimated_tariff_cost'],
};
