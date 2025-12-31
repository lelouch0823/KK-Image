import { ref, computed } from 'vue';
import { API } from '@/utils/constants';

// Global state to share across components (e.g. Header and List)
const notifications = ref([]);
const unreadCount = ref(0);
const loading = ref(false);
const initialized = ref(false);
let pollInterval = null;

export function useNotifications() {

    const fetchNotifications = async () => {
        loading.value = true;
        try {
            const res = await fetch(API.NOTIFICATIONS);
            const result = await res.json();
            if (result.success) {
                notifications.value = result.data.list;
                unreadCount.value = result.data.unreadCount;
                initialized.value = true;
            }
        } catch (e) {
            console.error('Failed to fetch notifications', e);
        } finally {
            loading.value = false;
        }
    };

    const markAsRead = async (id) => {
        // 乐观更新
        const item = notifications.value.find(n => n.id === id);
        if (item && item.is_read === 0) {
            item.is_read = 1;
            unreadCount.value = Math.max(0, unreadCount.value - 1);

            try {
                await fetch(API.NOTIFICATIONS_READ(id), { method: 'POST' });
            } catch (e) {
                // Revert if failed (optional, usually ignore)
                console.error('Failed to mark as read', e);
            }
        }
    };

    const markAllAsRead = async () => {
        // 乐观更新
        notifications.value.forEach(n => n.is_read = 1);
        unreadCount.value = 0;

        try {
            await fetch(API.NOTIFICATIONS_READ('all'), { method: 'POST' });
        } catch (e) {
            console.error('Failed to mark all as read', e);
        }
    };

    // 轮询 (单例模式)
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
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        startPolling,
        stopPolling
    };
}
