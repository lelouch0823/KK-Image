export const purchaseOrderActionAdapter = {
  entityType: 'purchase_order',
  actionType: 'create_purchase_order',
  targetModule: 'purchaseOrders',
  requiredPermission: 'products:manage',
  requiredSlots: ['mode'],
  getRequiredSlots(slots = {}) {
    const mode = String(slots.mode || '').trim();
    if (mode === 'manual') return ['mode', 'items'];
    if (mode === 'from_orders') return ['mode', 'order_ids'];
    return ['mode'];
  },
  getMissingSlots(slots = {}) {
    const mode = String(slots.mode || '').trim();
    if (!mode) return ['mode'];

    if (mode === 'manual') {
      const items = Array.isArray(slots.items) ? slots.items : [];
      const hasResolvedItems = items.length > 0
        && items.every((item) => item?.product_id && item?.variant_id);
      return hasResolvedItems ? [] : ['items'];
    }

    if (mode === 'from_orders') {
      const orderIds = Array.isArray(slots.order_ids) ? slots.order_ids.filter(Boolean) : [];
      return orderIds.length > 0 ? [] : ['order_ids'];
    }

    return [];
  },
  optionalSlots: ['items', 'order_ids', 'remark', 'currency', 'allocation_method', 'estimated_shipping_cost', 'estimated_tariff_cost'],
  fieldLabels: {
    mode: '创建方式',
    items: '采购明细',
    order_ids: '订单ID',
    remark: '备注',
    currency: '币种',
    allocation_method: '分摊方式',
    estimated_shipping_cost: '预计运费',
    estimated_tariff_cost: '预计关税',
  },
};
