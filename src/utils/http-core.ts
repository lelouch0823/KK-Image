/**
 * HTTP 核心请求层
 *
 * 极简封装：仅处理 HTTP 层错误（非 2xx），不解析成功响应的 JSON body。
 * 超时、重试、认证等逻辑由上层（useAuth / useResource）处理。
 */

import { AppError } from './app-error';

const DEFAULT_TIMEOUT = 30000; // 30 秒

/**
 * 发送 HTTP 请求
 *
 * @param url - 请求 URL
 * @param options - fetch 选项（含可选 timeout）
 * @returns fetch 响应对象
 * @throws 非 2xx 响应时抛出带 status 和 data 属性的 Error
 */
export async function request(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  // 如果调用者已提供 signal，不包装超时（避免冲突）
  const shouldTimeout = !fetchOptions.signal && timeout > 0;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | undefined;

  if (shouldTimeout) {
    abortController = new AbortController();
    fetchOptions.signal = abortController.signal;
    timeoutId = setTimeout(() => abortController?.abort(), timeout);
  }

  try {
    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new AppError(data.error || data.message || res.statusText, res.status, data);
    }

    return res;
  } catch (error: unknown) {
    // 将 AbortError（超时触发）转为更友好的错误格式
    if (error instanceof Error && error.name === 'AbortError' && shouldTimeout) {
      const err = new AppError('请求超时', 0);
      err.code = 'TIMEOUT';
      throw err;
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
