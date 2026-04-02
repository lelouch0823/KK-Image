import { API_BASE_URL, STORAGE_KEYS } from '../../utils/constants';

export interface SalesRequestResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  code: string | null;
  status: number;
}

export interface SalesRequestOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, unknown> | unknown[];
  header?: Record<string, string>;
}

function getToken(): string | null {
  return wx.getStorageSync(STORAGE_KEYS.TOKEN) || null;
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
      method,
      data,
      header: requestHeader,
      success: (res) => {
        const payload = (res.data || {}) as Record<string, unknown>;
        resolve({
          success: Boolean(payload.success),
          data: (payload.data as T) ?? null,
          error: (payload.error as string) || (payload.message as string) || null,
          code: (payload.code as string) || null,
          status: Number(res.statusCode || 0),
        });
      },
      fail: () =>
        resolve({
          success: false,
          data: null,
          error: '网络请求失败',
          code: 'NETWORK_ERROR',
          status: 0,
        }),
    });
  });
}
