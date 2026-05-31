/**
 * 统一异步状态管理 Composable
 *
 * 提供标准的 loading / error / errorCode / empty 状态管理，
 * 消除各 composable 中重复的手动 ref 声明和 try/catch 模式。
 *
 * 用法示例：
 * ```js
 * const { loading, error, errorCode, isEmpty, execute } = useAsyncState();
 *
 * const loadOrders = () => execute(
 *   () => authFetchJson(API.ORDERS),
 *   { onSuccess: (data) => orders.value = data }
 * );
 * ```
 *
 * @module composables/useAsyncState
 */

import { ref, type Ref } from 'vue';
import { ErrorCode, isAuthError } from '@/utils/error-codes';
import { classifyError, extractErrorMessage, handleApiError, type AddToastFn } from '@/utils/api-helpers';

interface AsyncStateOptions {
  t?: (key: string) => string;
  addToast?: AddToastFn;
  showToast?: boolean;
  fallbackKey?: string;
}

interface ExecuteOptions<T = unknown> {
  onSuccess?: (result: T) => void;
  onError?: (error: { code: string; message: string }) => void;
  silent?: boolean;
  shouldAbort?: () => boolean;
}

interface AsyncStateResult {
  loading: Ref<boolean>;
  error: Ref<string | null>;
  errorCode: Ref<string | null>;
  clearError: () => void;
  reset: () => void;
  execute: <T = unknown>(asyncFn: () => Promise<T>, opts?: ExecuteOptions<T>) => Promise<T | undefined>;
  setError: (code: string, message: string) => void;
}

interface AsyncStateWithRaceResult extends AsyncStateResult {
  requestId: () => number;
}

/**
 * 创建统一的异步状态管理实例
 *
 * @param options
 * @returns 状态 refs 和 execute 方法
 */
export function useAsyncState(options: AsyncStateOptions = {}): AsyncStateResult {
  const {
    t,
    addToast,
    showToast = true,
    fallbackKey = 'common.networkError',
  } = options;

  const loading: Ref<boolean> = ref(false);
  const error: Ref<string | null> = ref(null);
  const errorCode: Ref<string | null> = ref(null);

  /**
   * 清除错误状态
   */
  const clearError = (): void => {
    error.value = null;
    errorCode.value = null;
  };

  /**
   * 重置所有状态
   */
  const reset = (): void => {
    loading.value = false;
    error.value = null;
    errorCode.value = null;
  };

  /**
   * 执行异步操作并自动管理状态
   *
   * @param asyncFn - 异步函数（返回 Promise）
   * @param opts
   * @returns asyncFn 的返回值，失败时返回 undefined
   */
  const execute = async <T = unknown>(asyncFn: () => Promise<T>, opts: ExecuteOptions<T> = {}): Promise<T | undefined> => {
    const { onSuccess, onError, silent = false, shouldAbort } = opts;

    loading.value = true;
    clearError();

    try {
      const result = await asyncFn();

      // 竞态检查：如果 shouldAbort 返回 true，丢弃结果
      if (shouldAbort?.()) return undefined;

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (e: unknown) {
      // AbortError 静默处理
      if (e instanceof Error && e.name === 'AbortError') return undefined;

      // 竞态检查
      if (shouldAbort?.()) return undefined;

      const { code, message } = handleApiError(e, {
        t,
        addToast: (!silent && showToast) ? addToast : undefined,
        fallbackKey,
      });

      errorCode.value = code;
      error.value = message;

      if (onError) {
        onError({ code, message });
      }

      return undefined;
    } finally {
      if (!shouldAbort?.()) {
        loading.value = false;
      }
    }
  };

  /**
   * 设置错误状态（用于手动设置，如业务层错误）
   */
  const setError = (code: string, message: string): void => {
    errorCode.value = code;
    error.value = message;
  };

  return {
    loading,
    error,
    errorCode,
    clearError,
    reset,
    execute,
    setError,
  };
}

/**
 * 创建带 requestId 竞态保护的异步状态管理
 *
 * 适用于需要防竞态的场景（如搜索、筛选加载）。
 * 过期的请求结果会被自动丢弃。
 *
 * @param options - 同 useAsyncState
 * @returns 同 useAsyncState + requestId
 */
export function useAsyncStateWithRace(options: AsyncStateOptions = {}): AsyncStateWithRaceResult {
  const state = useAsyncState(options);
  let requestId = 0;

  /**
   * 执行异步操作（带竞态保护）
   *
   * @param asyncFn - 异步函数
   * @param opts - 同 execute 的选项
   */
  const executeWithRace = async <T = unknown>(asyncFn: () => Promise<T>, opts: ExecuteOptions<T> = {}): Promise<T | undefined> => {
    const currentRequestId = ++requestId;

    return state.execute(asyncFn, {
      ...opts,
      shouldAbort: () => currentRequestId !== requestId,
    });
  };

  return {
    ...state,
    execute: executeWithRace,
    requestId: () => requestId,
  };
}
