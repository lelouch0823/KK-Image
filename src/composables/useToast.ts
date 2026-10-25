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

// 同时展示的 toast 上限：批量操作失败风暴时避免无限堆叠遮挡屏幕
const MAX_VISIBLE_TOASTS = 5;

// 非法/遗留类型归一化，保证 ToastContainer 的图标与语义色始终命中
const VALID_TYPES = new Set(['success', 'error', 'warning', 'info']);
const TYPE_ALIASES: Record<string, string> = {
  danger: 'error',
  alert: 'error',
  failure: 'error',
  fail: 'error',
  ok: 'success',
  message: 'info',
};
const normalizeType = (type: string): string => {
  if (VALID_TYPES.has(type)) return type;
  return TYPE_ALIASES[type] || 'info';
};

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
    t = normalizeType(t);

    const id = generateRandomId('toast');
    toasts.value.push({ id, message: msg, type: t });
    if (toasts.value.length > MAX_VISIBLE_TOASTS) {
      // 保留最新的 N 条，丢弃最旧的
      toasts.value = toasts.value.slice(-MAX_VISIBLE_TOASTS);
    }

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
