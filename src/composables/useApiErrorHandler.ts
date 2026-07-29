import { ref } from 'vue';
import { classifyError, extractErrorMessage } from '@/utils/api-helpers';
import { ErrorCode } from '@/utils/error-codes';

/**
 * 统一 API 错误处理 composable
 *
 * 封装 classifyError + extractErrorMessage + ErrorCode 判断，
 * 消除各 view 中重复的错误处理样板代码。
 *
 * @example
 * const { error, errorCode, handleError, resetError } = useApiErrorHandler();
 * try { ... } catch (e) { handleError(e, '加载失败'); }
 * // 模板中：
 * <PermissionDeniedState v-if="errorCode === ErrorCode.FORBIDDEN" />
 */

type TranslateFn = (key: string, fallback?: string) => string;

export function useApiErrorHandler(t?: TranslateFn) {
  const error = ref('');
  const errorCode = ref<string | null>(null);

  /**
   * 处理 API 错误
   * @param err - 捕获的异常
   * @param fallbackMessage - 默认错误消息
   * @returns 错误码
   */
  const handleError = (err: unknown, fallbackMessage: string = ''): string => {
    const code = classifyError(err);
    errorCode.value = code;

    if (code === ErrorCode.FORBIDDEN) {
      error.value = extractErrorMessage(err, fallbackMessage || (t ? t('common.error.forbidden') : '权限不足'));
    } else {
      error.value = extractErrorMessage(err, fallbackMessage || (t ? t('common.loadFailed') : '加载失败'));
    }

    return code;
  };

  /** 重置错误状态 */
  const resetError = () => {
    error.value = '';
    errorCode.value = null;
  };

  return {
    error,
    errorCode,
    handleError,
    resetError,
    isForbidden: () => errorCode.value === ErrorCode.FORBIDDEN,
  };
}
