/**
 * 桌面通知封装
 * @module composables/useNotification
 */
import { ref } from 'vue';
import { useI18n } from './useI18n';

/**
 * 桌面通知 composable
 * @returns {Object}
 */
export function useNotification() {
    const { t } = useI18n();

    // 通知权限状态
    const permission = ref(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );

    // 是否支持通知
    const isSupported = ref(typeof Notification !== 'undefined');

    /**
     * 请求通知权限
     * @returns {Promise<boolean>} 是否获得权限
     */
    const requestPermission = async () => {
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
     * @param {string} title - 通知标题
     * @param {Object} options - 通知选项
     * @param {string} options.body - 通知正文
     * @param {string} options.icon - 图标 URL
     * @param {string} options.tag - 通知标签 (用于去重)
     * @param {Function} options.onClick - 点击回调
     * @returns {Notification|null}
     */
    const showNotification = (title, options = {}) => {
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
                ...notificationOptions
            });

            if (onClick) {
                notification.onclick = (e) => {
                    e.preventDefault();
                    window.focus();
                    onClick(e);
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
     * @param {Object} order - 订单对象
     * @param {Function} onClick - 点击回调
     */
    const showOrderFeedbackNotification = (order, onClick) => {
        showNotification(t('notification.newFeedback'), {
            body: `${t('order.orderNo')}: ${order.orderNo}`,
            tag: `order-feedback-${order.id}`,
            onClick
        });
    };

    return {
        permission,
        isSupported,
        requestPermission,
        showNotification,
        showOrderFeedbackNotification
    };
}
