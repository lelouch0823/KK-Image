export const orderActionAdapter = {
  entityType: 'order',
  actionType: 'create_order',
  targetModule: 'orders',
  requiredSlots: ['productName', 'salespersonId'],
  optionalSlots: ['productId', 'variantId', 'quantity', 'brand', 'series', 'sku', 'size', 'color', 'material', 'remark', 'deadline', 'status', 'fileIds'],
};
