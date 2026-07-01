/**
 * API 响应处理工具函数
 *
 * 提供统一的错误分类、消息提取、JSON 解析、超时控制。
 * 消除各 composable 中重复的 try/catch 错误处理代码。
 */

import { ErrorCode } from './error-codes';
import { AppError, isAppError } from './app-error';
import type { ApiResponse } from '@/composables/useResource';

/**
 * addToast / showToast 回调函数类型
 *
 * 与 useToast 的 showToast 签名一致，支持字符串传参和对象传参两种形式。
 */
export type AddToastFn = (message: string | { message: string; type?: string }, type?: string, duration?: number) => string;

/**
 * 从异常对象中分类错误码
 *
 * 支持两种异常格式：
 * - http-core 抛出的 AppError（带 .status, .data 属性）
 * - 原生 fetch 抛出的 TypeError（网络异常，无 status）
 *
 * @param error - 捕获的异常
 * @returns ErrorCode 枚举值
 */
export function classifyError(error: unknown): string {
  // 兼容 AppError、普通 Error 对象、以及 { status } 普通对象
  let status: number | undefined;
  if (isAppError(error)) {
    status = error.status;
  } else if (error && typeof error === 'object' && 'status' in error) {
    status = (error as { status: number }).status;
  }

  if (status === 401) return ErrorCode.UNAUTHORIZED;
  if (status === 403) return ErrorCode.FORBIDDEN;
  if (status !== undefined && status >= 500) return ErrorCode.SERVER_ERROR;
  return ErrorCode.NETWORK_ERROR;
}

/**
 * 从异常对象中提取用户友好的错误消息
 *
 * 优先级：error.data.error > error.message > i18n fallback
 *
 * @param error - 捕获的异常
 * @param fallback - 兜底消息
 */
export function extractErrorMessage(error: unknown, fallback: string = ''): string {
  if (isAppError(error)) {
    return error.data.error || error.message || fallback;
  }
  if (error instanceof Error) {
    // 兼容普通 Error 对象带 data 属性的情况
    const data = 'data' in error ? (error as Error & { data?: { error?: string } }).data : undefined;
    return data?.error || error.message || fallback;
  }
  // 兼容普通对象（如 { data: { error: '...' }, message: '...' }）
  if (error && typeof error === 'object') {
    const obj = error as { data?: { error?: string }; message?: string };
    return obj.data?.error || obj.message || fallback;
  }
  return fallback;
}

/**
 * 解析 API JSON 响应并检查 success 字段
 *
 * 项目所有 API 统一返回 `{ success, data, ... }` 结构。
 * 此函数封装了 "fetch → json → check success" 的重复模式。
 *
 * @param response - fetch Response 对象
 * @returns 解析后的 JSON 数据
 * @throws 如果 success 为 false，抛出带 status 和 data 的 Error
 */
export async function parseApiResponse(response: Response): Promise<unknown> {
  const json = await response.json();

  if (!json.success) {
    throw new AppError(json.error || json.message || '请求失败', response.status, json);
  }

  return json;
}

/**
 * 为 Promise 添加超时控制
 *
 * @param promise - 原始 Promise
 * @param ms - 超时毫秒数（默认 30000）
 * @returns 带超时的 Promise
 */
export function withTimeout(promise: Promise<unknown>, ms: number = 30000): Promise<unknown> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        const err = new AppError('请求超时', 0);
        err.code = 'TIMEOUT';
        reject(err);
      }, ms);
    }),
  ]);
}

/**
 * 封装 API 调用的标准模式：fetch + JSON 解析 + 成功/失败 toast
 *
 * 消除 composable 中重复的 try/catch + json.success 判断 + addToast 模式。
 * 成功时返回 data，失败时返回 null。
 *
 * @param action - API 调用函数（返回 Promise<Response>）
 * @param options - 配置项
 * @returns 成功时返回 data，失败时返回 null
 *
 * @example
 * const data = await apiAction<PurchaseOrder>(
 *   () => authFetch(API_URL, { method: 'POST', body }),
 *   { successMessage: t('purchaseOrder.toast.created'), addToast }
 * );
 */
export async function apiAction<T = unknown>(
  action: () => Promise<Response>,
  options: {
    successMessage?: string;
    errorMessage?: string;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    addToast?: AddToastFn;
    showToast?: boolean; // 默认 true
  } = {}
): Promise<T | null> {
  const { successMessage, errorMessage, onSuccess, onError, addToast, showToast = true } = options;
  try {
    const res = await action();
    const json = (await res.json()) as ApiResponse;

    if (json.success) {
      if (showToast && addToast && successMessage) {
        addToast({ message: successMessage, type: 'success' });
      }
      // data 为 undefined/null 时回退到整个 json 对象，确保成功时返回非 null 值
      const data = (json.data !== undefined ? json.data : json) as T;
      onSuccess?.(data);
      return data;
    } else {
      const errMsg = json.error || errorMessage || '操作失败';
      if (showToast && addToast) {
        addToast({ message: errMsg, type: 'error' });
      }
      onError?.(new Error(errMsg));
      return null;
    }
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(errorMessage || 'API call failed:', err);
    if (showToast && addToast) {
      const errMsg = err.message || errorMessage || '操作失败';
      addToast({ message: errMsg, type: 'error' });
    }
    onError?.(err);
    return null;
  }
}

/**
 * 统一的 API 错误处理
 *
 * 将 classifyError + extractErrorMessage + toast 通知组合为一个调用。
 * 返回 { code, message } 供调用方设置 errorCode/error ref。
 *
 * @param error - 捕获的异常
 * @param options - 配置项
 */
export function handleApiError(
  error: unknown,
  options: {
    t?: (key: string) => string;
    addToast?: AddToastFn;
    fallbackKey?: string;
  } = {}
): { code: string; message: string } {
  const { t, addToast, fallbackKey = 'common.networkError' } = options;

  const code = classifyError(error);
  const message = extractErrorMessage(error, t?.(fallbackKey) || '');

  // 权限类错误不弹 toast（由视图层显示专属 UI）
  if (addToast && code !== ErrorCode.UNAUTHORIZED && code !== ErrorCode.FORBIDDEN) {
    addToast({ message, type: 'error' });
  }

  return { code, message };
}
