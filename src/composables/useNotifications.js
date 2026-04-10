import { ref } from 'vue';
import { API } from '@/utils/constants';
import { useAuth } from '@/composables/useAuth';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';

// Global state to share across components (e.g. Header and List)
const notifications = ref([]);
const unreadCount = ref(0);
const loading = ref(false);
const initialized = ref(false);
const permissionDenied = ref(false);
const permissionDeniedReason = ref('');
const lastNotificationTime = ref(Date.now()); // SOTA: Signal for auto-refresh
let pollInterval = null;
let notificationRequestId = 0;

// 模式和 token 配置
let currentMode = 'admin'; // 'admin' | 'sales'
let salesToken = null;

/**
 * 通知中心 Composable
 * 支持管理端和销售端两种模式
 */
export function useNotifications() {
  const { authFetch } = useAuth();
  const { publishRefresh } = useAppRefreshBus();

  /**
   * 设置销售端模式
   * @param {string} token - 销售端访问 token
   */
  const setSalesMode = (token) => {
    notificationRequestId += 1;
    currentMode = 'sales';
    salesToken = token;
    // 重置状态
    notifications.value = [];
    unreadCount.value = 0;
    initialized.value = false;
    permissionDenied.value = false;
    permissionDeniedReason.value = '';
  };

  /**
   * 设置管理端模式
   */
  const setAdminMode = () => {
    notificationRequestId += 1;
    currentMode = 'admin';
    salesToken = null;
    notifications.value = [];
    unreadCount.value = 0;
    initialized.value = false;
    permissionDenied.value = false;
    permissionDeniedReason.value = '';
  };

  /**
   * 获取当前模式的 API 端点
   */
  const getApiUrl = () => {
    if (currentMode === 'sales' && salesToken) {
      return API.SALES_NOTIFICATIONS(salesToken);
    }
    return API.NOTIFICATIONS;
  };

  /**
   * 获取已读 API 端点
   */
  const getReadApiUrl = (id) => {
    if (currentMode === 'sales' && salesToken) {
      return API.SALES_NOTIFICATIONS_READ(salesToken, id);
    }
    return API.NOTIFICATIONS_READ(id);
  };

  const fetchNotifications = async () => {
    const requestId = ++notificationRequestId;
    const mode = currentMode;
    loading.value = true;
    try {
      const res = await authFetch(getApiUrl());
      const result = await res.json();
      if (requestId !== notificationRequestId) {
        return false;
      }
      if (result.success) {
        permissionDenied.value = false;
        permissionDeniedReason.value = '';
        const newUnreadCount = result.data.unreadCount;

        // SOTA: 如果未读数量增加，说明有新消息，触发刷新信号
        if (newUnreadCount > unreadCount.value) {
          lastNotificationTime.value = Date.now();
          publishRefresh({
            module: mode === 'sales' ? 'salesOrders' : 'orders',
            reason: 'notification',
          });
        }

        notifications.value = result.data.list;
        unreadCount.value = newUnreadCount;
        initialized.value = true;
        return true;
      }
    } catch (e) {
      if (requestId !== notificationRequestId) {
        return false;
      }
      if (Number(e?.status) === 403) {
        permissionDenied.value = true;
        permissionDeniedReason.value = e?.data?.error || e?.message || '权限不足';
        stopPolling();
        return;
      }
      console.error('Failed to fetch notifications', e);
    } finally {
      if (requestId === notificationRequestId) {
        loading.value = false;
      }
    }
    return false;
  };

  /**
   * 标记通知为已读
   * @param {string} id - 通知 ID
   */
  const markAsRead = async (id) => {
    // 乐观更新
    const item = notifications.value.find((n) => n.id === id);
    if (item && item.is_read === 0) {
      item.is_read = 1;
      unreadCount.value = Math.max(0, unreadCount.value - 1);

      try {
        await authFetch(getReadApiUrl(id), { method: 'POST' });
      } catch (e) {
        // Revert if failed (optional, usually ignore)
        console.error('Failed to mark as read', e);
      }
    }
  };

  /**
   * 标记所有通知为已读
   */
  const markAllAsRead = async () => {
    // 乐观更新
    notifications.value.forEach((n) => (n.is_read = 1));
    unreadCount.value = 0;

    try {
      await authFetch(getReadApiUrl('all'), { method: 'POST' });
    } catch (e) {
      console.error('Failed to mark all as read', e);
    }
  };

  /**
   * 启动轮询更新通知
   * @param {number} interval - 轮询间隔 (毫秒)
   */
  const startPolling = (interval = 10000) => {
    if (pollInterval) return;

    const checkAndFetch = () => {
      if (!document.hidden) {
        fetchNotifications();
      }
    };

    fetchNotifications(); // Initial fetch
    pollInterval = setInterval(checkAndFetch, interval);
  };

  /**
   * 停止轮询
   */
  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    initialized,
    permissionDenied,
    permissionDeniedReason,
    lastNotificationTime, // Export signal
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    startPolling,
    stopPolling,
    // 模式切换
    setSalesMode,
    setAdminMode,
  };
}
