/**
 * 库存预警看板 Composable (Inventory Dashboard)
 * ==============================================
 *
 * 封装库存预警看板页面的数据获取和加载逻辑。
 *
 * @module composables/useInventoryDashboard
 */

import { ref } from 'vue';
import { API } from '@/utils/constants';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { handleApiError } from '@/utils/api-helpers';

/** 库存摘要 */
interface InventorySummary {
  totalSkus: number;
  lowStockCount: number;
  zeroStockCount: number;
  totalInventoryValue: number;
}

/** 低库存项 */
interface LowStockItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  variantLabel: string;
  available: number;
  onHand: number;
  reserved: number;
  alertThreshold: number;
}

/** 零库存项 */
interface ZeroStockItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  variantLabel: string;
  onHand: number;
  reserved: number;
}

/** 库存变动记录 */
interface InventoryMovement {
  id: string;
  variantId: string;
  eventType: string;
  quantityDelta: number;
  occurredAt: number;
  sku: string;
  productName: string;
  variantLabel: string;
}

/** 出库排行项 */
interface TopMovingItem {
  variantId: string;
  sku: string;
  productName: string;
  variantLabel: string;
  totalOutbound: number;
}

/** 看板数据 */
interface InventoryDashboardData {
  summary: InventorySummary;
  lowStockItems: LowStockItem[];
  zeroStockItems: ZeroStockItem[];
  recentMovements: InventoryMovement[];
  topMovingItems: TopMovingItem[];
}

/** API 响应 */
interface InventoryDashboardApiResponse {
  success: boolean;
  data?: InventoryDashboardData;
  error?: string;
}

export function useInventoryDashboard() {
  const { authFetch } = useAuth();
  const { t } = useI18n();
  const data = ref<InventoryDashboardData | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const errorCode = ref<string | null>(null);
  let requestId = 0;

  /**
   * 加载看板数据
   */
  const loadData = async (): Promise<boolean> => {
    const currentRequestId = ++requestId;
    loading.value = true;
    error.value = null;
    errorCode.value = null;

    try {
      const res = await authFetch(API.MANAGE_INVENTORY_DASHBOARD);
      const json: InventoryDashboardApiResponse = await res.json();

      if (currentRequestId !== requestId) return false;

      if (json.success && json.data) {
        data.value = json.data;
        return true;
      }

      data.value = null;
      error.value = json.error || t('common.loadFailed');
      return false;
    } catch (e: unknown) {
      if (currentRequestId !== requestId) return false;
      console.error('loadInventoryDashboard failed:', e);
      data.value = null;
      const { code, message } = handleApiError(e, { t, addToast: undefined, fallbackKey: 'common.loadFailed' });
      errorCode.value = code;
      error.value = message;
      return false;
    } finally {
      if (currentRequestId === requestId) {
        loading.value = false;
      }
    }
  };

  /**
   * 初始化
   */
  const init = async (): Promise<void> => {
    data.value = null;
    await loadData();
  };

  return {
    data,
    loading,
    error,
    errorCode,
    loadData,
    init,
  };
}
