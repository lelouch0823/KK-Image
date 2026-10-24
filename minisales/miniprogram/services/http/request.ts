import { API_BASE_URL, STORAGE_KEYS } from '../../utils/constants';

export interface SalesRequestResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  code: string | null;
  status: number;
  detail: string | null;
  payload: Record<string, unknown>;
}

export interface SalesRequestOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  header?: Record<string, string>;
  /**
   * 幂等键（F9）：变更请求（POST/PUT/PATCH）必带。省略时按请求自动生成；
   * 同一逻辑操作的多层调用（如表单提交内部重试）应显式传入同一键，
   * 让服务端 command_idempotency 凭键去重而非二次执行。
   */
  idempotencyKey?: string;
}

type RequestData = WechatMiniprogram.IAnyObject | string | ArrayBuffer | undefined;

function getToken(): string | null {
  return wx.getStorageSync(STORAGE_KEYS.TOKEN) || null;
}

const IDEMPOTENCY_HEADER = 'Idempotency-Key';

function isMutationMethod(method: SalesRequestOptions['method']): boolean {
  const normalized = (method || 'GET').toUpperCase();
  return normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH';
}

/** 小程序环境无 crypto.randomUUID，用时间戳+随机数生成带前缀的幂等键 */
function createIdempotencyKey(): string {
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toRequestData(value: unknown): RequestData {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (typeof value === 'string' || value instanceof ArrayBuffer) {
    return value;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as WechatMiniprogram.IAnyObject;
  }
  return undefined;
}

export async function salesRequest<T>({
  path,
  method = 'GET',
  data,
  header = {},
  idempotencyKey,
}: SalesRequestOptions): Promise<SalesRequestResult<T>> {
  const token = getToken();
  const requestHeader = {
    'Content-Type': 'application/json',
    ...header,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    // F9：与 Web 端 http-core 对齐——变更请求默认注入幂等键。
    // 后端（ALLOW_MISSING_IDEMPOTENCY_KEY）计划收紧为强制，小程序是唯一缺口
    ...(isMutationMethod(method)
      ? { [IDEMPOTENCY_HEADER]: idempotencyKey || createIdempotencyKey() }
      : {}),
  };

  return new Promise((resolve) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method: method as any,
      data: toRequestData(data),
      header: requestHeader,
      timeout: 30000,
      success: (res) => {
        const payload = toRecord(res.data);
        const status = Number(res.statusCode || 0);
        const payloadSuccess = payload.success;
        const isSuccess =
          typeof payloadSuccess === 'boolean'
            ? payloadSuccess
            : status >= 200 && status < 300;

        resolve({
          success: isSuccess,
          data: (payload.data as T) ?? null,
          error: toStringOrNull(payload.error) || toStringOrNull(payload.message),
          code: toStringOrNull(payload.code),
          status,
          detail: null,
          payload,
        });
      },
      fail: (err) => {
        const detail = toStringOrNull(toRecord(err).errMsg);
        resolve({
          success: false,
          data: null,
          error: '网络请求失败',
          code: 'NETWORK_ERROR',
          status: 0,
          detail,
          payload: {},
        });
      },
    });
  });
}
