import { ref } from 'vue';

const toasts = ref([]);

export function useToast() {
    const showToast = (message, type = 'success', duration = 3000) => {
        const id = Date.now() + Math.random().toString(36).substr(2, 9);
        toasts.value.push({ id, message, type });

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
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
        removeToast,
        success,
        error,
        warning
    };
}
