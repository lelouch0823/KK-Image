import { ref, type Ref } from 'vue';
import { generateRandomId } from '@/utils/common';

interface Toast {
  id: string;
  message: string;
  type: string;
}

interface ShowToastOptions {
  message: string;
  type?: string;
  duration?: number;
}

const toasts: Ref<Toast[]> = ref([]);

export function useToast() {
  const showToast = (message: string | ShowToastOptions, type: string = 'success', duration: number = 3000): string => {
    let msg: string;
    let t: string;
    let d: number;

    // 支持对象传参 ({ message, type, duration })
    if (typeof message === 'object' && message !== null) {
      const opts = message as ShowToastOptions;
      msg = opts.message;
      t = opts.type || type;
      d = opts.duration || duration;
    } else {
      msg = message as string;
      t = type;
      d = duration;
    }

    const id = generateRandomId('toast');
    toasts.value.push({ id, message: msg, type: t });

    if (d > 0) {
      setTimeout(() => {
        removeToast(id);
      }, d);
    }

    return id;
  };

  const removeToast = (id: string): void => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  };

  const success = (message: string, duration?: number): string => showToast(message, 'success', duration);
  const error = (message: string, duration?: number): string => showToast(message, 'error', duration);
  const warning = (message: string, duration?: number): string => showToast(message, 'warning', duration);
  const info = (message: string, duration?: number): string => showToast(message, 'info', duration);

  return {
    toasts,
    showToast,
    addToast: showToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}
