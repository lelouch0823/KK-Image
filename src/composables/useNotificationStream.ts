import { ref, onScopeDispose } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useNotifications } from '@/composables/useNotifications';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';

/** 通知流配置 */
interface NotificationStreamConfig {
  /** 轮询间隔（毫秒），默认 30000 */
  pollInterval?: number;
  /** 页面不可见时是否暂停轮询，默认 true */
  pauseWhenHidden?: boolean;
  /** 新通知到达时是否显示 Toast，默认 true */
  showToast?: boolean;
  /** Toast 自动关闭延迟（毫秒），默认 4000 */
  toastDuration?: number;
}

/** 通知流 Composable 返回值 */
interface NotificationStreamReturn {
  /** 是否正在轮询 */
  isPolling: import('vue').Ref<boolean>;
  /** 上次轮询时间 */
  lastPollTime: import('vue').Ref<number>;
  /** 连接错误信息 */
  error: import('vue').Ref<string | null>;
  /** 启动轮询 */
  start: () => void;
  /** 停止轮询 */
  stop: () => void;
}

// 全局状态（跨组件共享）
const isPolling = ref(false);
const lastPollTime = ref(0);
const error = ref<string | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastKnownId: string | null = null;
let streamRequestId = 0;

/**
 * 通知实时推送 Composable（基于轮询）
 *
 * 通过定期轮询 `/api/manage/notifications/poll` 端点检测新通知。
 * 检测到新通知时自动更新 useNotifications 的状态，并可选显示 Toast 提醒。
 *
 * @param config - 轮询配置
 * @returns 轮询控制状态和方法
 *
 * @example
 * ```ts
 * const { isPolling, start, stop } = useNotificationStream();
 * start();
 * ```
 */
export function useNotificationStream(config: NotificationStreamConfig = {}): NotificationStreamReturn {
  const {
    pollInterval = 30000,
    pauseWhenHidden = true,
    showToast = true,
    toastDuration = 4000,
  } = config;

  const { authFetch } = useAuth();
  const { unreadCount, notifications, fetchNotifications } = useNotifications();
  const { addToast } = useToast();
  const { t } = useI18n();

  /**
   * 执行一次轮询
   */
  const poll = async (): Promise<void> => {
    const requestId = ++streamRequestId;
    try {
      const url = lastKnownId
        ? `${API.NOTIFICATIONS}/poll?last_id=${encodeURIComponent(lastKnownId)}`
        : `${API.NOTIFICATIONS}/poll`;

      const res = await authFetch(url);
      if (requestId !== streamRequestId) return; // 请求已过期

      const result = await res.json();
      if (requestId !== streamRequestId) return;

      if (!result.success) {
        error.value = result.error || '轮询失败';
        return;
      }

      const { unreadCount: newUnreadCount, latestId, newNotifications } = result.data;
      error.value = null;
      lastPollTime.value = Date.now();

      // 更新最新已知 ID
      if (latestId) {
        lastKnownId = latestId;
      }

      // 如果有新通知，更新全局状态
      if (newNotifications && newNotifications.length > 0) {
        // 合并新通知到列表（去重，保持排序）
        const existingIds = new Set(notifications.value.map((n) => n.id));
        const freshNotifications = newNotifications.filter((n: { id: string }) => !existingIds.has(n.id));

        if (freshNotifications.length > 0) {
          // 将新通知插入到列表头部
          notifications.value = [...freshNotifications, ...notifications.value].sort(
            (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
          );

          // 显示 Toast 提醒（仅显示最新的那条）
          if (showToast && freshNotifications.length > 0) {
            const latest = freshNotifications[0];
            addToast(latest.title || t('notification.newFeedback'), 'info', toastDuration);
          }
        }
      }

      // 更新未读数量
      unreadCount.value = newUnreadCount;
    } catch (e: unknown) {
      if (requestId !== streamRequestId) return;

      // 403 权限错误不作为轮询错误处理（useNotifications 已处理）
      if (typeof e === 'object' && e !== null && 'status' in e && Number((e as Record<string, unknown>).status) === 403) {
        stop();
        return;
      }

      error.value = e instanceof Error ? e.message : '轮询请求失败';
      console.error('[NotificationStream] 轮询失败:', e);
    }
  };

  /**
   * 启动轮询
   */
  const start = (): void => {
    if (pollTimer) return;

    isPolling.value = true;
    error.value = null;

    // 立即执行一次
    poll();

    // 设置定时器
    pollTimer = setInterval(() => {
      if (pauseWhenHidden && document.hidden) return;
      poll();
    }, pollInterval);
  };

  /**
   * 停止轮询
   */
  const stop = (): void => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    isPolling.value = false;
  };

  // 组件卸载时自动停止
  onScopeDispose(() => {
    stop();
  });

  return {
    isPolling,
    lastPollTime,
    error,
    start,
    stop,
  };
}
