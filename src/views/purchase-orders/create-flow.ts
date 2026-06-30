// 从 utils 重新导出，保持向后兼容
export {
  type PurchaseOrderItem,
  getTotalCreateQty,
  getShortageItems,
  getCreateFlowSourceItems,
  getExcludeOrderIds,
  getSelectedVariantIdsForPicker,
  getExistingBrands,
  buildCreatePurchaseItemsPayload,
} from '@/utils/purchase-order-request';
