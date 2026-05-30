/**
 * HTTP 核心请求层
 *
 * 极简封装：仅处理 HTTP 层错误（非 2xx），不解析成功响应的 JSON body。
 * 超时、重试、认证等逻辑由上层（useAuth / useResource）处理。
 */

const DEFAULT_TIMEOUT = 30000; // 30 秒

/**
 * 发送 HTTP 请求
 *
 * @param {string} url - 请求 URL
 * @param {Object} [options={}] - fetch 选项
 * @param {number} [options.timeout] - 超时毫秒数（默认 30s）
 * @returns {Promise<Response>} fetch 响应对象
 * @throws {Error} 非 2xx 响应时抛出带 status 和 data 属性的 Error
 */
export async function request(url, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  // 如果调用者已提供 signal，不包装超时（避免冲突）
  const shouldTimeout = !fetchOptions.signal && timeout > 0;

  let timeoutId;
  let abortController;

  if (shouldTimeout) {
    abortController = new AbortController();
    fetchOptions.signal = abortController.signal;
    timeoutId = setTimeout(() => abortController.abort(), timeout);
  }

  try {
    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.error || data.message || res.statusText);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return res;
  } catch (error) {
    // 将 AbortError（超时触发）转为更友好的错误格式
    if (error.name === 'AbortError' && shouldTimeout) {
      const err = new Error('请求超时');
      err.status = 0;
      err.code = 'TIMEOUT';
      throw err;
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
