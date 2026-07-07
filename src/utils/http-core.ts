/**
 * HTTP 核心请求层
 *
 * 极简封装：仅处理 HTTP 层错误（非 2xx），不解析成功响应的 JSON body。
 * 超时、重试、认证等逻辑由上层（useAuth / useResource）处理。
 */

import { AppError } from './app-error';

const DEFAULT_TIMEOUT = 30000; // 30 秒

// 翻译函数注入（避免 utils 层依赖 composable）
type TranslateFn = (key: string, fallback?: string) => string;
let _t: TranslateFn | null = null;

/** 注入翻译函数，应在应用初始化时调用 */
export function setHttpTranslator(t: TranslateFn): void {
  _t = t;
}

function abortControllerWithReason(controller: AbortController, reason?: unknown): void {
  if (controller.signal.aborted) return;
  try {
    controller.abort(reason);
  } catch {
    controller.abort();
  }
}

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

  const shouldTimeout = timeout > 0;
  const callerSignal = fetchOptions.signal;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | undefined;
  let removeCallerAbortListener: (() => void) | undefined;
  let didTimeout = false;

  if (shouldTimeout) {
    abortController = new AbortController();
    if (callerSignal) {
      const abortFromCaller = (): void => {
        abortControllerWithReason(abortController as AbortController, callerSignal.reason);
      };
      if (callerSignal.aborted) {
        abortFromCaller();
      } else {
        callerSignal.addEventListener('abort', abortFromCaller, { once: true });
        removeCallerAbortListener = () => callerSignal.removeEventListener('abort', abortFromCaller);
      }
    }
    fetchOptions.signal = abortController.signal;
    timeoutId = setTimeout(() => {
      didTimeout = true;
      abortController?.abort();
    }, timeout);
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
    if (error instanceof Error && error.name === 'AbortError' && didTimeout) {
      const err = new AppError(_t ? _t('http.timeout', '请求超时') : '请求超时', 0);
      err.code = 'TIMEOUT';
      throw err;
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    removeCallerAbortListener?.();
  }
}
