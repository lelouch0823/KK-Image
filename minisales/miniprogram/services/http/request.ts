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
}

function getToken(): string | null {
  return wx.getStorageSync(STORAGE_KEYS.TOKEN) || null;
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

export async function salesRequest<T>({
  path,
  method = 'GET',
  data,
  header = {},
}: SalesRequestOptions): Promise<SalesRequestResult<T>> {
  const token = getToken();
  const requestHeader = {
    'Content-Type': 'application/json',
    ...header,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return new Promise((resolve) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method: method as any,
      data,
      header: requestHeader,
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
