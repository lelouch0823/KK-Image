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

import { ref, computed } from 'vue';
import { ErrorCode, isAuthError } from '@/utils/error-codes';
import { classifyError, extractErrorMessage, handleApiError } from '@/utils/api-helpers';

/**
 * 创建统一的异步状态管理实例
 *
 * @param {Object} [options]
 * @param {Function} [options.t] - i18n 翻译函数
 * @param {Function} [options.addToast] - toast 通知函数
 * @param {boolean} [options.showToast=true] - 是否自动弹 toast
 * @param {string} [options.fallbackKey] - i18n fallback key
 * @returns {Object} 状态 refs 和 execute 方法
 */
export function useAsyncState(options = {}) {
  const {
    t,
    addToast,
    showToast = true,
    fallbackKey = 'common.networkError',
  } = options;

  const loading = ref(false);
  const error = ref(null);
  const errorCode = ref(null);

  /**
   * 清除错误状态
   */
  const clearError = () => {
    error.value = null;
    errorCode.value = null;
  };

  /**
   * 重置所有状态
   */
  const reset = () => {
    loading.value = false;
    error.value = null;
    errorCode.value = null;
  };

  /**
   * 执行异步操作并自动管理状态
   *
   * @param {Function} asyncFn - 异步函数（返回 Promise）
   * @param {Object} [opts]
   * @param {Function} [opts.onSuccess] - 成功回调（接收 asyncFn 的返回值）
   * @param {Function} [opts.onError] - 错误回调（接收 { code, message }）
   * @param {boolean} [opts.silent=false] - 静默模式（不弹 toast）
   * @param {Function} [opts.shouldAbort] - 返回 true 时跳过（用于 requestId 竞态检查）
   * @returns {Promise<any>} asyncFn 的返回值，失败时返回 undefined
   */
  const execute = async (asyncFn, opts = {}) => {
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
    } catch (e) {
      // AbortError 静默处理
      if (e.name === 'AbortError') return undefined;

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
  const setError = (code, message) => {
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
 * @param {Object} [options] - 同 useAsyncState
 * @returns {Object} 同 useAsyncState + requestId
 */
export function useAsyncStateWithRace(options = {}) {
  const state = useAsyncState(options);
  let requestId = 0;

  /**
   * 执行异步操作（带竞态保护）
   *
   * @param {Function} asyncFn - 异步函数
   * @param {Object} [opts] - 同 execute 的选项
   * @returns {Promise<any>}
   */
  const executeWithRace = async (asyncFn, opts = {}) => {
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
