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
 * @param {Error} error - 捕获的异常
 * @returns {string} ErrorCode 枚举值
 */
export function classifyError(error) {
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
 * @param {Error} error - 捕获的异常
 * @param {string} [fallback] - 兜底消息
 * @returns {string}
 */
export function extractErrorMessage(error, fallback = '') {
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
 * @param {Response} response - fetch Response 对象
 * @returns {Promise<Object>} 解析后的 JSON 数据
 * @throws {Error} 如果 success 为 false，抛出带 status 和 data 的 Error
 */
export async function parseApiResponse(response) {
  const json = await response.json();

  if (!json.success) {
    const err = new Error(json.error || json.message || '请求失败');
    err.status = response.status;
    err.data = json;
    throw err;
  }

  return json;
}

/**
 * 为 Promise 添加超时控制
 *
 * @param {Promise} promise - 原始 Promise
 * @param {number} ms - 超时毫秒数（默认 30000）
 * @returns {Promise} 带超时的 Promise
 */
export function withTimeout(promise, ms = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error('请求超时');
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
 * @param {Error} error - 捕获的异常
 * @param {Object} options
 * @param {Function} options.t - i18n 翻译函数
 * @param {Function} [options.addToast] - toast 通知函数（可选）
 * @param {string} [options.fallbackKey] - i18n fallback key
 * @returns {{ code: string, message: string }}
 */
export function handleApiError(error, options = {}) {
  const { t, addToast, fallbackKey = 'common.networkError' } = options;

  const code = classifyError(error);
  const message = extractErrorMessage(error, t?.(fallbackKey) || '');

  // 权限类错误不弹 toast（由视图层显示专属 UI）
  if (addToast && code !== ErrorCode.UNAUTHORIZED && code !== ErrorCode.FORBIDDEN) {
    addToast({ message, type: 'error' });
  }

  return { code, message };
}
