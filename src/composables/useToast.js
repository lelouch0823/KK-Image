import { ref } from 'vue';

const toasts = ref([]);

export function useToast() {
    const showToast = (message, type = 'success', duration = 3000) => {
        let msg, t, d;

        // 支持对象传参 ({ message, type, duration })
        if (typeof message === 'object' && message !== null) {
            msg = message.message;
            t = message.type || type;
            d = message.duration || duration;
        } else {
            msg = message;
            t = type;
            d = duration;
        }

        const id = Date.now() + Math.random().toString(36).substr(2, 9);
        toasts.value.push({ id, message: msg, type: t });

        if (d > 0) {
            setTimeout(() => {
                removeToast(id);
            }, d);
        }

        return id;
    };

    const removeToast = (id) => {
        toasts.value = toasts.value.filter(t => t.id !== id);
    };

    const success = (message, duration) => showToast(message, 'success', duration);
    const error = (message, duration) => showToast(message, 'error', duration);
    const warning = (message, duration) => showToast(message, 'warning', duration);

    return {
        toasts,
        showToast,
        addToast: showToast,
        removeToast,
        success,
        error,
        warning
    };
}
