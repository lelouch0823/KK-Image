/**
 * API 响应处理工具函数
 *
 * 提供统一的错误分类、消息提取、JSON 解析、超时控制。
 * 消除各 composable 中重复的 try/catch 错误处理代码。
 */

import { ErrorCode } from './error-codes';

/**
 * 从异常对象中分类错误码
 *
 * 支持两种异常格式：
 * - http-core 抛出的 Error（带 .status, .data 属性）
 * - 原生 fetch 抛出的 TypeError（网络异常，无 status）
 *
 * @param error - 捕获的异常
 * @returns ErrorCode 枚举值
 */
export function classifyError(error: any): string {
  const status = Number(error?.status);

  if (status === 401) return ErrorCode.UNAUTHORIZED;
  if (status === 403) return ErrorCode.FORBIDDEN;
  if (status >= 500) return ErrorCode.SERVER_ERROR;
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
export function extractErrorMessage(error: any, fallback: string = ''): string {
  return (
    error?.data?.error ||
    error?.message ||
    fallback
  );
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
export async function parseApiResponse(response: Response): Promise<any> {
  const json = await response.json();

  if (!json.success) {
    const err = new Error(json.error || json.message || '请求失败') as any;
    err.status = response.status;
    err.data = json;
    throw err;
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
export function withTimeout(promise: Promise<any>, ms: number = 30000): Promise<any> {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error('请求超时') as any;
        err.status = 0;
        err.code = 'TIMEOUT';
        reject(err);
      }, ms);
    }),
  ]);
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
  error: any,
  options: {
    t?: (key: string) => string;
    addToast?: (toast: { message: string; type: string }) => void;
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
