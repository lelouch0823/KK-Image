/**
 * 采购单 Composable (Purchase Orders)
 * =====================================
 *
 * 封装采购单管理页面的数据获取、列表/详情加载、统计等逻辑。
 * CRUD 和明细操作已拆分至子模块。
 *
 * @module composables/usePurchaseOrders
 */

import { ref, reactive, computed } from 'vue';
import { type ApiResponse } from './useResource';
import { API } from '@/utils/constants';
import {
  appendPurchaseOrderCacheBust,
} from '@/utils/purchase-order-request';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { handleApiError } from '@/utils/api-helpers';
import type {
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderStats,
  PurchaseOrderSuggestion,
  StatusStyleConfig,
} from './purchase-order/purchase-order-types';
import { usePurchaseOrderCrud } from './purchase-order/usePurchaseOrderCrud';
import { usePurchaseOrderItems } from './purchase-order/usePurchaseOrderItems';

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

  // ─── 子 Composable ────────────────────────────────────

  const crud = usePurchaseOrderCrud({ authFetch, addToast, t, detail, canWriteThroughDetail });
  const items = usePurchaseOrderItems({ authFetch, addToast, t });

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

  const refreshPurchaseOrderViews = async (purchaseOrderId: string | null = null): Promise<{ detailLoaded: boolean; listLoaded: boolean; statsLoaded: boolean }> => {
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
    ...crud,
    // 明细
    ...items,
    // 建议
    loadSuggestions,
  };
}
