/** 采购单列表项 */
export interface PurchaseOrder {
  id: string;
  poNo: string;
  status: string;
  displayStatus?: string;
  remark?: string;
  currency?: string;
  allocationMethod?: string;
  estimatedShippingCost?: number;
  estimatedTariffCost?: number;
  itemCount?: number;
  orderedQty?: number;
  receivedQty?: number;
  cancelledQty?: number;
  outstandingQty?: number;
  totalGoodsCost?: number;
  receiptCount?: number;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

/** 采购单明细项 */
export interface PurchaseOrderItem {
  id: string;
  poId: string;
  productId: string | null;
  variantId: string | null;
  preOrderId?: string | null;
  snapshotName?: string;
  snapshotSku?: string;
  snapshotSpecs?: string;
  snapshotImage?: string | null;
  snapshotBrand?: string;
  productName?: string;
  productSku?: string;
  productBrand?: string;
  variantSku?: string;
  variantOptions?: string;
  quantity: number;
  unitCost?: number;
  receivedQty?: number;
  cancelledQty?: number;
  receiptCount?: number;
  lastReceivedAt?: number;
  customerOrderNo?: string;
  [key: string]: unknown;
}

/** 采购单收货记录 */
export interface PurchaseReceipt {
  id: string;
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  productId: string | null;
  variantId: string | null;
  receivedQty: number;
  reversedQty?: number;
  reversalCount?: number;
  lastReversedAt?: number;
  availableReversalQty?: number;
  isReversed?: boolean;
  receivedAt?: number;
  createdAt?: number;
  [key: string]: unknown;
}

/** 采购单详情（含明细和收货记录） */
export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderItem[];
  receipts: PurchaseReceipt[];
  [key: string]: unknown;
}

/** 采购单统计数据 */
export interface PurchaseOrderStats {
  totalOrders?: number;
  totalValue?: number;
  pendingOrders?: number;
  completedOrders?: number;
  [key: string]: unknown;
}

/** 采购单智能建议 */
export interface PurchaseOrderSuggestion {
  id: string;
  type?: string;
  message?: string;
  productId?: string;
  variantId?: string;
  quantity?: number;
  [key: string]: unknown;
}

/** 状态颜色配置 */
export interface StatusStyleConfig {
  label: string;
  color: string;
  bg: string;
}

/** 添加明细载荷 */
export interface AddItemsPayload {
  productId?: string;
  variantId?: string;
  quantity?: number;
  unitCost?: number;
  [key: string]: unknown;
}

/** 收货登记载荷 */
export interface RecordReceiptsPayload {
  items?: { itemId: string; quantity: number }[];
  [key: string]: unknown;
}

/** 缺口关闭载荷 */
export interface CloseShortagesPayload {
  items?: { itemId: string; closeQty?: number }[];
  [key: string]: unknown;
}

/** 创建结果 */
export interface CreateResult {
  detailLoaded: boolean;
  listLoaded: boolean;
  statsLoaded: boolean;
}
