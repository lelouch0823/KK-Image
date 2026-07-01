/**
 * 采购单 Composable (Purchase Orders)
 * =====================================
 *
 * 封装采购单管理页面的数据获取、CRUD 操作、状态变更等逻辑。
 *
 * @module composables/usePurchaseOrders
 */

import { ref, reactive, computed } from 'vue';
import { type ApiResponse } from './useResource';
import { API } from '@/utils/constants';
import {
  appendPurchaseOrderCacheBust,
  buildPurchaseOrderIdempotentJsonHeaders,
} from '@/utils/purchase-order-request';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { handleApiError, apiAction } from '@/utils/api-helpers';

// ============================================================
// 类型定义
// ============================================================

/** 采购单列表项 */
interface PurchaseOrder {
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
interface PurchaseOrderItem {
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
interface PurchaseReceipt {
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
interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderItem[];
  receipts: PurchaseReceipt[];
  [key: string]: unknown;
}

/** 采购单统计数据 */
interface PurchaseOrderStats {
  totalOrders?: number;
  totalValue?: number;
  pendingOrders?: number;
  completedOrders?: number;
  [key: string]: unknown;
}

/** 采购单智能建议 */
interface PurchaseOrderSuggestion {
  id: string;
  type?: string;
  message?: string;
  productId?: string;
  variantId?: string;
  quantity?: number;
  [key: string]: unknown;
}

/** 状态颜色配置 */
interface StatusStyleConfig {
  label: string;
  color: string;
  bg: string;
}

/** 添加明细载荷 */
interface AddItemsPayload {
  productId?: string;
  variantId?: string;
  quantity?: number;
  unitCost?: number;
  [key: string]: unknown;
}

/** 收货登记载荷 */
interface RecordReceiptsPayload {
  items?: { itemId: string; quantity: number }[];
  [key: string]: unknown;
}

/** 缺口关闭载荷 */
interface CloseShortagesPayload {
  items?: { itemId: string; closeQty?: number }[];
  [key: string]: unknown;
}

/** 创建结果 */
interface CreateResult {
  detailLoaded: boolean;
  listLoaded: boolean;
  statsLoaded: boolean;
}

export function usePurchaseOrders() {
  const { addToast } = useToast();
  const { t } = useI18n();
  const { authFetch } = useAuth();

  // ─── 状态 ────────────────────────────────────────────
  const list = ref<PurchaseOrder[]>([]);
  const total = ref<number>(0);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const errorCode = ref<string | null>(null);
  const detail = ref<PurchaseOrderDetail | null>(null);
  const detailLoading = ref<boolean>(false);
  const suggestions = ref<PurchaseOrderSuggestion[]>([]);
  const suggestionsLoading = ref<boolean>(false);
  const stats = ref<PurchaseOrderStats | null>(null);
  let listRequestId = 0;
  let detailRequestId = 0;
  let suggestionsRequestId = 0;
  let statsRequestId = 0;

  const filters = reactive({
    status: '',
    page: 1,
    limit: 20,
  });

  const canWriteThroughDetail = (purchaseOrderId: string): boolean => {
    if (!detail.value?.id) return true;
    return String(detail.value.id) === String(purchaseOrderId || '');
  };

  // ─── 状态颜色映射 ──────────────────────────────────────

  const statusConfig = computed<Record<string, StatusStyleConfig>>(() => ({
    draft: {
      label: t('purchaseOrder.status.draft'),
      color: 'var(--text-secondary)',
      bg: 'var(--bg-muted)',
    },
    ordered: {
      label: t('purchaseOrder.status.ordered'),
      color: 'var(--color-warning-text)',
      bg: 'var(--color-warning-bg)',
    },
    shipping: {
      label: t('purchaseOrder.status.shipping'),
      color: 'var(--color-primary)',
      bg: 'var(--color-primary-bg)',
    },
    arrived: {
      label: t('purchaseOrder.status.arrived'),
      color: 'var(--color-info-text)',
      bg: 'var(--color-info-bg)',
    },
    completed: {
      label: t('purchaseOrder.status.completed'),
      color: 'var(--color-success-text)',
      bg: 'var(--color-success-bg)',
    },
    cancelled: {
      label: t('purchaseOrder.status.cancelled'),
      color: 'var(--color-danger-text)',
      bg: 'var(--color-danger-bg)',
    },
  }));

  // ─── 列表 ────────────────────────────────────────────

  const loadList = async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<boolean> => {
    const requestId = ++listRequestId;
    loading.value = true;
    error.value = null;
    errorCode.value = null;
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      params.set('page', String(filters.page));
      params.set('limit', String(filters.limit));

      const res = await authFetch(
        appendPurchaseOrderCacheBust(`${API.MANAGE_PURCHASE_ORDERS}?${params}`, { forceRefresh })
      );
      const json = await res.json() as ApiResponse;
      if (requestId !== listRequestId) {
        return false;
      }

      if (json.success) {
        list.value = json.data as PurchaseOrder[];
        total.value = (json.pagination as { total?: number })?.total ?? 0;
        return true;
      }

      error.value = json.error || t('purchaseOrder.error.loadFailed');
      addToast({ message: error.value, type: 'error' });
      return false;
    } catch (e: unknown) {
      if (requestId !== listRequestId) {
        return false;
      }
      console.error('loadPurchaseOrders failed:', e);
      const { code, message } = handleApiError(e, { t, addToast, fallbackKey: 'purchaseOrder.error.loadFailed' });
      errorCode.value = code;
      error.value = message;
      return false;
    } finally {
      if (requestId === listRequestId) {
        loading.value = false;
      }
    }
  };

  // ─── 详情 ────────────────────────────────────────────

  const loadDetail = async (id: string, { forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<boolean> => {
    const requestId = ++detailRequestId;
    detailLoading.value = true;
    try {
      const res = await authFetch(
        appendPurchaseOrderCacheBust(API.MANAGE_PURCHASE_ORDER_BY_ID(id), { forceRefresh })
      );
      const json = await res.json() as ApiResponse;
      if (requestId !== detailRequestId) {
        return false;
      }

      if (json.success) {
        detail.value = json.data as PurchaseOrderDetail;
        return true;
      } else {
        addToast({ message: json.error || t('purchaseOrder.error.notFound'), type: 'error' });
        return false;
      }
    } catch (e: unknown) {
      if (requestId !== detailRequestId) {
        return false;
      }
      console.error('loadPurchaseOrderDetail failed:', e);
      return false;
    } finally {
      if (requestId === detailRequestId) {
        detailLoading.value = false;
      }
    }
  };

  const loadPurchaseOrderOverview = async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<{ listLoaded: boolean; statsLoaded: boolean }> => {
    const [listLoaded, statsLoaded] = await Promise.all([
      loadList({ forceRefresh }),
      loadStats({ forceRefresh }),
    ]);
    return { listLoaded, statsLoaded };
  };

  const refreshPurchaseOrderViews = async (purchaseOrderId: string | null = null): Promise<CreateResult> => {
    if (purchaseOrderId) {
      const [detailLoaded, overview] = await Promise.all([
        loadDetail(purchaseOrderId, { forceRefresh: true }),
        loadPurchaseOrderOverview({ forceRefresh: true }),
      ]);
      return { detailLoaded, ...overview };
    }

    const overview = await loadPurchaseOrderOverview({ forceRefresh: true });
    return { detailLoaded: false, ...overview };
  };

  // ─── 创建 ────────────────────────────────────────────

  const createPO = async (data: Record<string, unknown>): Promise<PurchaseOrder | null> => {
    return apiAction<PurchaseOrder>(
      () => authFetch(API.MANAGE_PURCHASE_ORDERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
      { successMessage: t('purchaseOrder.toast.created'), addToast }
    );
  };

  /**
   * 从客户订单快速创建采购单
   */
  const createFromOrders = async (orderIds: string[], poData: Record<string, unknown> = {}): Promise<PurchaseOrder | null> => {
    const uniqueOrderIds = [...new Set((orderIds || []).filter(Boolean))];
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_FROM_ORDERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: uniqueOrderIds, ...poData }),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({ message: t('purchaseOrder.toast.createdFromOrders'), type: 'success' });
        return json.data as PurchaseOrder;
      } else {
        addToast({ message: json.error || '', type: 'error' });
        return null;
      }
    } catch (e: unknown) {
      console.error('createFromOrders failed:', e);
      const err = e as Error;
      addToast({ message: err.message, type: 'error' });
      return null;
    }
  };

  // ─── 更新 ────────────────────────────────────────────

  const updatePO = async (id: string, updates: Record<string, unknown>): Promise<boolean> => {
    const result = await apiAction<PurchaseOrderDetail>(
      () => authFetch(API.MANAGE_PURCHASE_ORDER_BY_ID(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }),
      {
        successMessage: t('purchaseOrder.toast.updated'),
        addToast,
        onSuccess: (data) => {
          if (canWriteThroughDetail(id)) {
            detail.value = data;
          }
        },
      }
    );
    return result !== null;
  };

  // ─── 状态变更 ────────────────────────────────────────

  const updateStatus = async (id: string, newStatus: string): Promise<boolean> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_STATUS(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        const data = json.data as { message?: string };
        addToast({
          message: data?.message || t('purchaseOrder.toast.statusUpdated'),
          type: 'success',
        });
        return true;
      } else {
        addToast({ message: json.error || '', type: 'error' });
        return false;
      }
    } catch (e: unknown) {
      console.error('updateStatus failed:', e);
      const err = e as Error;
      addToast({ message: err.message, type: 'error' });
      return false;
    }
  };

  // ─── 明细操作 ────────────────────────────────────────

  const addItems = async (poId: string, items: AddItemsPayload[]): Promise<boolean> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_ITEMS(poId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({ message: t('purchaseOrder.toast.itemsAdded'), type: 'success' });
        return true;
      }
      addToast({ message: json.error || '', type: 'error' });
      return false;
    } catch (e: unknown) {
      console.error('addItems failed:', e);
      return false;
    }
  };

  const updateItem = async (poId: string, itemId: string, updates: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_ITEM(poId, itemId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.itemUpdated') || '明细已更新',
          type: 'success',
        });
        return true;
      }
      addToast({ message: json.error || '', type: 'error' });
      return false;
    } catch (e: unknown) {
      console.error('updateItem failed:', e);
      return false;
    }
  };

  const removeItem = async (poId: string, itemId: string): Promise<boolean> => {
    const result = await apiAction(
      () => authFetch(API.MANAGE_PURCHASE_ORDER_ITEM(poId, itemId), {
        method: 'DELETE',
      }),
      { successMessage: t('purchaseOrder.toast.itemRemoved'), addToast }
    );
    return result !== null;
  };

  const recordReceipts = async (poId: string, payload: RecordReceiptsPayload): Promise<unknown> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_RECEIPTS(poId), {
        method: 'POST',
        headers: buildPurchaseOrderIdempotentJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.receiptsRecorded') || '收货已登记',
          type: 'success',
        });
        return json.data;
      }
      addToast({ message: json.error || '', type: 'error' });
      return null;
    } catch (e: unknown) {
      console.error('recordReceipts failed:', e);
      const err = e as Error;
      addToast({ message: err.message, type: 'error' });
      return null;
    }
  };

  const reverseReceipt = async (poId: string, receiptId: string, payload: Record<string, unknown> = {}): Promise<unknown> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_RECEIPT_REVERSAL(poId, receiptId), {
        method: 'POST',
        headers: buildPurchaseOrderIdempotentJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.receiptReversed') || '收货冲销已提交',
          type: 'success',
        });
        return json.data;
      }
      addToast({ message: json.error || '', type: 'error' });
      return null;
    } catch (e: unknown) {
      console.error('reverseReceipt failed:', e);
      const err = e as Error;
      addToast({ message: err.message, type: 'error' });
      return null;
    }
  };

  const closeShortages = async (poId: string, payload: CloseShortagesPayload): Promise<unknown> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_SHORTAGE_CLOSURES(poId), {
        method: 'POST',
        headers: buildPurchaseOrderIdempotentJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.shortageClosed') || '待收数量已关闭',
          type: 'success',
        });
        return json.data;
      }
      addToast({ message: json.error || '', type: 'error' });
      return null;
    } catch (e: unknown) {
      console.error('closeShortages failed:', e);
      const err = e as Error;
      addToast({ message: err.message, type: 'error' });
      return null;
    }
  };

  // ─── 成本分摊 ────────────────────────────────────────

  const allocateCosts = async (poId: string): Promise<boolean> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_ALLOCATE(poId), {
        method: 'POST',
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        if (canWriteThroughDetail(poId)) {
          detail.value = json.data as PurchaseOrderDetail;
        }
        addToast({ message: t('purchaseOrder.toast.allocated'), type: 'success' });
        return true;
      }
      addToast({ message: json.error || '', type: 'error' });
      return false;
    } catch (e: unknown) {
      console.error('allocateCosts failed:', e);
      return false;
    }
  };

  // ─── 智能建议 ────────────────────────────────────────

  const loadSuggestions = async (): Promise<boolean> => {
    const requestId = ++suggestionsRequestId;
    suggestionsLoading.value = true;
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_SUGGESTIONS);
      const json = await res.json() as ApiResponse;
      if (requestId !== suggestionsRequestId) {
        return false;
      }

      if (json.success) {
        suggestions.value = json.data as PurchaseOrderSuggestion[];
        return true;
      }
      suggestions.value = [];
    } catch (e: unknown) {
      if (requestId !== suggestionsRequestId) {
        return false;
      }
      console.error('loadSuggestions failed:', e);
      suggestions.value = [];
    } finally {
      if (requestId === suggestionsRequestId) {
        suggestionsLoading.value = false;
      }
    }
    return false;
  };

  // ─── 统计 ────────────────────────────────────────────

  const loadStats = async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<boolean> => {
    const requestId = ++statsRequestId;
    try {
      const res = await authFetch(
        appendPurchaseOrderCacheBust(API.MANAGE_PURCHASE_ORDER_STATS, { forceRefresh })
      );
      const json = await res.json() as ApiResponse;
      if (requestId !== statsRequestId) {
        return false;
      }
      if (json.success) {
        stats.value = json.data as PurchaseOrderStats;
        return true;
      }

      return false;
    } catch (e: unknown) {
      if (requestId !== statsRequestId) {
        return false;
      }
      console.error('loadStats failed:', e);
      const err = e as Error & { status?: number };
      const status = Number(err?.status || 0);
      // 统计接口权限应只影响统计模块，不应覆盖列表权限态（避免整页误封）
      if (status === 401 || status === 403) {
        stats.value = null;
        return false;
      }
      return false;
    }
  };

  return {
    // 状态
    list,
    total,
    loading,
    error,
    errorCode,
    detail,
    detailLoading,
    suggestions,
    suggestionsLoading,
    stats,
    filters,
    statusConfig,
    // 列表
    loadList,
    loadStats,
    loadPurchaseOrderOverview,
    // 详情
    loadDetail,
    refreshPurchaseOrderViews,
    // CRUD
    createPO,
    createFromOrders,
    updatePO,
    // 状态
    updateStatus,
    // 明细
    addItems,
    removeItem,
    updateItem,
    recordReceipts,
    reverseReceipt,
    closeShortages,
    // 成本
    allocateCosts,
    // 建议
    loadSuggestions,
  };
}
