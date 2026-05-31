/**
 * 桌面通知封装
 * @module composables/usePushNotification
 */
import { ref, type Ref } from 'vue';
import { useI18n } from './useI18n';

interface NotificationOptionsExtended {
  body?: string;
  icon?: string;
  tag?: string;
  onClick?: (e: MouseEvent) => void;
}

interface OrderInfo {
  id: string | number;
  orderNo: string;
}

/**
 * 桌面通知 composable
 */
export function usePushNotification() {
  const { t } = useI18n();

  // 通知权限状态
  const permission: Ref<NotificationPermission> = ref(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  // 是否支持通知
  const isSupported: Ref<boolean> = ref(typeof Notification !== 'undefined');

  /**
   * 请求通知权限
   * @returns 是否获得权限
   */
  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported.value) {
      return false;
    }

    if (permission.value === 'granted') {
      return true;
    }

    try {
      const result = await Notification.requestPermission();
      permission.value = result;
      return result === 'granted';
    } catch (e) {
      console.warn('Notification permission request failed:', e);
      return false;
    }
  };

  /**
   * 显示桌面通知
   * @param title - 通知标题
   * @param options - 通知选项
   */
  const showNotification = (title: string, options: NotificationOptionsExtended = {}): Notification | null => {
    if (!isSupported.value) {
      console.warn('Notifications not supported');
      return null;
    }

    if (permission.value !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    const { onClick, ...notificationOptions } = options;

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        ...notificationOptions,
      });

      if (onClick) {
        notification.onclick = (e) => {
          e.preventDefault();
          window.focus();
          onClick(e as MouseEvent);
          notification.close();
        };
      }

      return notification;
    } catch (e) {
      console.warn('Failed to show notification:', e);
      return null;
    }
  };

  /**
   * 显示新订单反馈通知
   * @param order - 订单对象
   * @param onClick - 点击回调
   */
  const showOrderFeedbackNotification = (order: OrderInfo, onClick?: (e: MouseEvent) => void): void => {
    showNotification(t('notification.newFeedback'), {
      body: `${t('order.orderNo')}: ${order.orderNo}`,
      tag: `order-feedback-${order.id}`,
      onClick,
    });
  };

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    showOrderFeedbackNotification,
  };
}
