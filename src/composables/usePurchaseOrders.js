/**
 * 采购单 Composable (Purchase Orders)
 * =====================================
 *
 * 封装采购单管理页面的数据获取、CRUD 操作、状态变更等逻辑。
 *
 * @module composables/usePurchaseOrders
 */

import { ref, reactive, computed } from 'vue';
import { API } from '@/utils/constants';
import {
  appendPurchaseOrderCacheBust,
  buildPurchaseOrderIdempotentJsonHeaders,
} from '@/utils/purchase-order-request';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { handleApiError } from '@/utils/api-helpers';

export function usePurchaseOrders() {
  const { addToast } = useToast();
  const { t } = useI18n();
  const { authFetch } = useAuth();

  // ─── 状态 ────────────────────────────────────────────
  const list = ref([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref(null);
  const errorCode = ref(null);
  const detail = ref(null);
  const detailLoading = ref(false);
  const suggestions = ref([]);
  const suggestionsLoading = ref(false);
  const stats = ref(null);
  let listRequestId = 0;
  let detailRequestId = 0;
  let suggestionsRequestId = 0;
  let statsRequestId = 0;

  const filters = reactive({
    status: '',
    page: 1,
    limit: 20,
  });

  const canWriteThroughDetail = (purchaseOrderId) => {
    if (!detail.value?.id) return true;
    return String(detail.value.id) === String(purchaseOrderId || '');
  };

  // ─── 状态颜色映射 ──────────────────────────────────────

  const statusConfig = computed(() => ({
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

  const loadList = async ({ forceRefresh = false } = {}) => {
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
      const json = await res.json();
      if (requestId !== listRequestId) {
        return false;
      }

      if (json.success) {
        list.value = json.data;
        total.value = json.pagination?.total ?? 0;
        return true;
      }

      error.value = json.error || t('purchaseOrder.error.loadFailed');
      addToast({ message: error.value, type: 'error' });
      return false;
    } catch (e) {
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

  const loadDetail = async (id, { forceRefresh = false } = {}) => {
    const requestId = ++detailRequestId;
    detailLoading.value = true;
    try {
      const res = await authFetch(
        appendPurchaseOrderCacheBust(API.MANAGE_PURCHASE_ORDER_BY_ID(id), { forceRefresh })
      );
      const json = await res.json();
      if (requestId !== detailRequestId) {
        return false;
      }

      if (json.success) {
        detail.value = json.data;
        return true;
      } else {
        addToast({ message: json.error || t('purchaseOrder.error.notFound'), type: 'error' });
        return false;
      }
    } catch (e) {
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

  const loadPurchaseOrderOverview = async ({ forceRefresh = false } = {}) => {
    const [listLoaded, statsLoaded] = await Promise.all([
      loadList({ forceRefresh }),
      loadStats({ forceRefresh }),
    ]);
    return { listLoaded, statsLoaded };
  };

  const refreshPurchaseOrderViews = async (purchaseOrderId = null) => {
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

  const createPO = async (data) => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.success) {
        addToast({ message: t('purchaseOrder.toast.created'), type: 'success' });
        return json.data;
      } else {
        addToast({ message: json.error, type: 'error' });
        return null;
      }
    } catch (e) {
      console.error('createPO failed:', e);
      addToast({ message: e.message, type: 'error' });
      return null;
    }
  };

  /**
   * 从客户订单快速创建采购单
   */
  const createFromOrders = async (orderIds, poData = {}) => {
    const uniqueOrderIds = [...new Set((orderIds || []).filter(Boolean))];
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_FROM_ORDERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: uniqueOrderIds, ...poData }),
      });
      const json = await res.json();

      if (json.success) {
        addToast({ message: t('purchaseOrder.toast.createdFromOrders'), type: 'success' });
        return json.data;
      } else {
        addToast({ message: json.error, type: 'error' });
        return null;
      }
    } catch (e) {
      console.error('createFromOrders failed:', e);
      addToast({ message: e.message, type: 'error' });
      return null;
    }
  };

  // ─── 更新 ────────────────────────────────────────────

  const updatePO = async (id, updates) => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_BY_ID(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json();

      if (json.success) {
        if (canWriteThroughDetail(id)) {
          detail.value = json.data;
        }
        addToast({ message: t('purchaseOrder.toast.updated'), type: 'success' });
        return true;
      } else {
        addToast({ message: json.error, type: 'error' });
        return false;
      }
    } catch (e) {
      console.error('updatePO failed:', e);
      return false;
    }
  };

  // ─── 状态变更 ────────────────────────────────────────

  const updateStatus = async (id, newStatus) => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_STATUS(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();

      if (json.success) {
        addToast({
          message: json.data.message || t('purchaseOrder.toast.statusUpdated'),
          type: 'success',
        });
        return true;
      } else {
        addToast({ message: json.error, type: 'error' });
        return false;
      }
    } catch (e) {
      console.error('updateStatus failed:', e);
      addToast({ message: e.message, type: 'error' });
      return false;
    }
  };

  // ─── 明细操作 ────────────────────────────────────────

  const addItems = async (poId, items) => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_ITEMS(poId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();

      if (json.success) {
        addToast({ message: t('purchaseOrder.toast.itemsAdded'), type: 'success' });
        return true;
      }
      addToast({ message: json.error, type: 'error' });
      return false;
    } catch (e) {
      console.error('addItems failed:', e);
      return false;
    }
  };

  const updateItem = async (poId, itemId, updates) => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_ITEM(poId, itemId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json();

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.itemUpdated') || '明细已更新',
          type: 'success',
        });
        return true;
      }
      addToast({ message: json.error, type: 'error' });
      return false;
    } catch (e) {
      console.error('updateItem failed:', e);
      return false;
    }
  };

  const removeItem = async (poId, itemId) => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_ITEM(poId, itemId), {
        method: 'DELETE',
      });
      const json = await res.json();

      if (json.success) {
        addToast({ message: t('purchaseOrder.toast.itemRemoved'), type: 'success' });
        return true;
      }
      addToast({ message: json.error, type: 'error' });
      return false;
    } catch (e) {
      console.error('removeItem failed:', e);
      return false;
    }
  };

  const recordReceipts = async (poId, payload) => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_RECEIPTS(poId), {
        method: 'POST',
        headers: buildPurchaseOrderIdempotentJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.receiptsRecorded') || '收货已登记',
          type: 'success',
        });
        return json.data;
      }
      addToast({ message: json.error, type: 'error' });
      return null;
    } catch (e) {
      console.error('recordReceipts failed:', e);
      addToast({ message: e.message, type: 'error' });
      return null;
    }
  };

  const reverseReceipt = async (poId, receiptId, payload = {}) => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_RECEIPT_REVERSAL(poId, receiptId), {
        method: 'POST',
        headers: buildPurchaseOrderIdempotentJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.receiptReversed') || '收货冲销已提交',
          type: 'success',
        });
        return json.data;
      }
      addToast({ message: json.error, type: 'error' });
      return null;
    } catch (e) {
      console.error('reverseReceipt failed:', e);
      addToast({ message: e.message, type: 'error' });
      return null;
    }
  };

  const closeShortages = async (poId, payload) => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_SHORTAGE_CLOSURES(poId), {
        method: 'POST',
        headers: buildPurchaseOrderIdempotentJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.shortageClosed') || '待收数量已关闭',
          type: 'success',
        });
        return json.data;
      }
      addToast({ message: json.error, type: 'error' });
      return null;
    } catch (e) {
      console.error('closeShortages failed:', e);
      addToast({ message: e.message, type: 'error' });
      return null;
    }
  };

  // ─── 成本分摊 ────────────────────────────────────────

  const allocateCosts = async (poId) => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_ALLOCATE(poId), {
        method: 'POST',
      });
      const json = await res.json();

      if (json.success) {
        if (canWriteThroughDetail(poId)) {
          detail.value = json.data;
        }
        addToast({ message: t('purchaseOrder.toast.allocated'), type: 'success' });
        return true;
      }
      addToast({ message: json.error, type: 'error' });
      return false;
    } catch (e) {
      console.error('allocateCosts failed:', e);
      return false;
    }
  };

  // ─── 智能建议 ────────────────────────────────────────

  const loadSuggestions = async () => {
    const requestId = ++suggestionsRequestId;
    suggestionsLoading.value = true;
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_SUGGESTIONS);
      const json = await res.json();
      if (requestId !== suggestionsRequestId) {
        return false;
      }

      if (json.success) {
        suggestions.value = json.data;
        return true;
      }
      suggestions.value = [];
    } catch (e) {
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

  const loadStats = async ({ forceRefresh = false } = {}) => {
    const requestId = ++statsRequestId;
    try {
      const res = await authFetch(
        appendPurchaseOrderCacheBust(API.MANAGE_PURCHASE_ORDER_STATS, { forceRefresh })
      );
      const json = await res.json();
      if (requestId !== statsRequestId) {
        return false;
      }
      if (json.success) {
        stats.value = json.data;
        return true;
      }

      return false;
    } catch (e) {
      if (requestId !== statsRequestId) {
        return false;
      }
      console.error('loadStats failed:', e);
      const status = Number(e?.status || 0);
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
