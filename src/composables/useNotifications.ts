import { ref, onScopeDispose, getCurrentScope } from 'vue';
import { API } from '@/utils/constants';
import { useAuth } from '@/composables/useAuth';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { useI18n } from '@/composables/useI18n';

/** 通知项接口 */
interface Notification {
  id: string;
  title?: string;
  message?: string;
  is_read: number;
  type?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** 通知 API 响应接口 */
interface NotificationsApiResponse {
  success: boolean;
  data?: {
    list: Notification[];
    unreadCount: number;
  };
  error?: string;
  [key: string]: unknown;
}

// Global state to share across components (e.g. Header and List)
const notifications = ref<Notification[]>([]);
const unreadCount = ref<number>(0);
const loading = ref<boolean>(false);
const initialized = ref<boolean>(false);
const permissionDenied = ref<boolean>(false);
const permissionDeniedReason = ref<string>('');
const lastNotificationTime = ref<number>(Date.now()); // SOTA: Signal for auto-refresh
let pollInterval: ReturnType<typeof setInterval> | null = null;
let pollingOwner: symbol | null = null;
let notificationRequestId = 0;

// 模式和 token 配置
let currentMode: 'admin' | 'sales' = 'admin';
let salesToken: string | null = null;

/**
 * 通知中心 Composable
 * 支持管理端和销售端两种模式
 */
export function useNotifications() {
  const { authFetch } = useAuth();
  const { publishRefresh } = useAppRefreshBus();
  const { t } = useI18n();
  const ownerId = Symbol('notifications-poll-owner');

  const stopActivePolling = (): void => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    pollingOwner = null;
  };

  /**
   * 设置销售端模式
   * @param token - 销售端访问 token
   */
  const setSalesMode = (token: string): void => {
    if (currentMode !== 'sales' || salesToken !== token) {
      stopActivePolling();
    }
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
  const setAdminMode = (): void => {
    if (currentMode !== 'admin' || salesToken !== null) {
      stopActivePolling();
    }
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
  const getApiUrl = (): string => {
    if (currentMode === 'sales' && salesToken) {
      return API.SALES_NOTIFICATIONS(salesToken);
    }
    return API.NOTIFICATIONS;
  };

  /**
   * 获取已读 API 端点
   */
  const getReadApiUrl = (id: string): string => {
    if (currentMode === 'sales' && salesToken) {
      return API.SALES_NOTIFICATIONS_READ(salesToken, id);
    }
    return API.NOTIFICATIONS_READ(id);
  };

  const fetchNotifications = async (): Promise<boolean> => {
    const requestId = ++notificationRequestId;
    const mode = currentMode;
    loading.value = true;
    try {
      const res = await authFetch(getApiUrl());
      const result: NotificationsApiResponse = await res.json();
      if (requestId !== notificationRequestId) {
        return false;
      }
      if (result.success && result.data) {
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
    } catch (e: unknown) {
      if (requestId !== notificationRequestId) {
        return false;
      }
      if (typeof e === 'object' && e !== null && 'status' in e && Number((e as Record<string, unknown>).status) === 403) {
        permissionDenied.value = true;
        const errObj = e as Record<string, unknown>;
        permissionDeniedReason.value = (typeof errObj.data === 'object' && errObj.data !== null && 'error' in (errObj.data as Record<string, unknown>))
          ? String((errObj.data as Record<string, unknown>).error)
          : (errObj.message as string) || t('common.error.forbidden');
        stopActivePolling();
        return false;
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
   * @param id - 通知 ID
   */
  const markAsRead = async (id: string): Promise<void> => {
    // 乐观更新
    const item = notifications.value.find((n) => n.id === id);
    if (item && item.is_read === 0) {
      item.is_read = 1;
      unreadCount.value = Math.max(0, unreadCount.value - 1);

      try {
        await authFetch(getReadApiUrl(id), { method: 'POST' });
      } catch (e: unknown) {
        // Revert if failed (optional, usually ignore)
        console.error('Failed to mark as read', e);
      }
    }
  };

  /**
   * 标记所有通知为已读
   */
  const markAllAsRead = async (): Promise<void> => {
    // 乐观更新
    notifications.value.forEach((n) => (n.is_read = 1));
    unreadCount.value = 0;

    try {
      await authFetch(getReadApiUrl('all'), { method: 'POST' });
    } catch (e: unknown) {
      console.error('Failed to mark all as read', e);
    }
  };

  /**
   * 启动轮询更新通知
   * @param interval - 轮询间隔 (毫秒)
   */
  const startPolling = (interval: number = 10000): void => {
    if (pollInterval) return;
    pollingOwner = ownerId;

    const checkAndFetch = (): void => {
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
  const stopPolling = (): void => {
    if (pollingOwner !== ownerId) return;
    stopActivePolling();
  };

  // 组件卸载时自动停止轮询
  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopPolling();
    });
  }

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
