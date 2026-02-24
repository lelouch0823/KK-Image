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
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

export function usePurchaseOrders() {
  const { addToast } = useToast();
  const { t } = useI18n();

  // ─── 状态 ────────────────────────────────────────────
  const list = ref([]);
  const total = ref(0);
  const loading = ref(false);
  const detail = ref(null);
  const detailLoading = ref(false);
  const suggestions = ref([]);
  const suggestionsLoading = ref(false);
  const stats = ref(null);

  const filters = reactive({
    status: '',
    page: 1,
    limit: 20,
  });

  // ─── 状态颜色映射 ──────────────────────────────────────

  const statusConfig = computed(() => ({
    draft: { label: t('purchaseOrder.status.draft'), color: 'var(--text-secondary)', bg: 'var(--bg-muted)' },
    ordered: { label: t('purchaseOrder.status.ordered'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    shipping: { label: t('purchaseOrder.status.shipping'), color: 'var(--color-purple)', bg: 'var(--color-purple-bg)' },
    arrived: { label: t('purchaseOrder.status.arrived'), color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
    completed: { label: t('purchaseOrder.status.completed'), color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    cancelled: { label: t('purchaseOrder.status.cancelled'), color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
  }));

  // ─── 列表 ────────────────────────────────────────────

  const loadList = async () => {
    loading.value = true;
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      params.set('page', String(filters.page));
      params.set('limit', String(filters.limit));

      const res = await fetch(`${API.MANAGE_PURCHASE_ORDERS}?${params}`);
      const json = await res.json();

      if (json.success) {
        list.value = json.data.items;
        total.value = json.data.total;
      }
    } catch (e) {
      console.error('loadPurchaseOrders failed:', e);
      addToast({ message: t('purchaseOrder.error.loadFailed'), type: 'error' });
    } finally {
      loading.value = false;
    }
  };

  // ─── 详情 ────────────────────────────────────────────

  const loadDetail = async (id) => {
    detailLoading.value = true;
    try {
      const res = await fetch(API.MANAGE_PURCHASE_ORDER_BY_ID(id));
      const json = await res.json();

      if (json.success) {
        detail.value = json.data;
      } else {
        addToast({ message: json.error || t('purchaseOrder.error.notFound'), type: 'error' });
      }
    } catch (e) {
      console.error('loadPurchaseOrderDetail failed:', e);
    } finally {
      detailLoading.value = false;
    }
  };

  // ─── 创建 ────────────────────────────────────────────

  const createPO = async (data) => {
    try {
      const res = await fetch(API.MANAGE_PURCHASE_ORDERS, {
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
    try {
      const res = await fetch(API.MANAGE_PURCHASE_ORDER_FROM_ORDERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: orderIds, ...poData }),
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
      const res = await fetch(API.MANAGE_PURCHASE_ORDER_BY_ID(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json();

      if (json.success) {
        detail.value = json.data;
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
      const res = await fetch(API.MANAGE_PURCHASE_ORDER_STATUS(id), {
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
      const res = await fetch(API.MANAGE_PURCHASE_ORDER_ITEMS(poId), {
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

  const removeItem = async (poId, itemId) => {
    try {
      const res = await fetch(API.MANAGE_PURCHASE_ORDER_ITEM(poId, itemId), {
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

  // ─── 成本分摊 ────────────────────────────────────────

  const allocateCosts = async (poId) => {
    try {
      const res = await fetch(API.MANAGE_PURCHASE_ORDER_ALLOCATE(poId), {
        method: 'POST',
      });
      const json = await res.json();

      if (json.success) {
        detail.value = json.data;
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
    suggestionsLoading.value = true;
    try {
      const res = await fetch(API.MANAGE_PURCHASE_ORDER_SUGGESTIONS);
      const json = await res.json();

      if (json.success) {
        suggestions.value = json.data;
      }
    } catch (e) {
      console.error('loadSuggestions failed:', e);
    } finally {
      suggestionsLoading.value = false;
    }
  };

  // ─── 统计 ────────────────────────────────────────────

  const loadStats = async () => {
    try {
      const res = await fetch(API.MANAGE_PURCHASE_ORDER_STATS);
      const json = await res.json();
      if (json.success) stats.value = json.data;
    } catch (e) {
      console.error('loadStats failed:', e);
    }
  };

  return {
    // 状态
    list, total, loading, detail, detailLoading,
    suggestions, suggestionsLoading, stats,
    filters, statusConfig,
    // 列表
    loadList, loadStats,
    // 详情
    loadDetail,
    // CRUD
    createPO, createFromOrders, updatePO,
    // 状态
    updateStatus,
    // 明细
    addItems, removeItem,
    // 成本
    allocateCosts,
    // 建议
    loadSuggestions,
  };
}
