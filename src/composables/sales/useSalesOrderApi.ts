import { useAuth } from '@/composables/useAuth';
import { API, SALES_ORDER_PAGE_SIZE } from '@/utils/constants';

const toQueryString = (params: Record<string, any> = {}): string => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.append(key, String(value));
  });
  return query.toString();
};

const toErrorMessage = (payload: any, fallback: string = 'Request failed'): string =>
  payload?.error || payload?.message || fallback;

interface ApiResponse {
  ok: boolean;
  data: any;
  pagination?: any;
  error: string | null;
  status: number;
}

export function useSalesOrderApi() {
  const { authFetch } = useAuth();

  const request = async (url: string, options: RequestInit = {}): Promise<ApiResponse> => {
    try {
      const response = await authFetch(url, options);
      const status = response?.status ?? 0;
      const payload: any = await response.json();

      if (payload?.success) {
        return {
          ok: true,
          data: payload.data ?? null,
          pagination: payload.pagination ?? null,
          error: null,
          status,
        };
      }

      return {
        ok: false,
        data: null,
        error: toErrorMessage(payload),
        status,
      };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || 'Network error',
        status: 0,
      };
    }
  };

  const auth = (token: string): Promise<ApiResponse> => request(API.SALES_AUTH(token));

  const login = (token: string, password: string): Promise<ApiResponse> =>
    request(API.SALES_AUTH(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

  const list = (token: string, params: Record<string, any> = {}): Promise<ApiResponse> => {
    const query = toQueryString({
      page: params.page ?? 1,
      limit: params.limit ?? SALES_ORDER_PAGE_SIZE,
      search: params.search ?? '',
    });
    return request(`${API.SALES_ORDER_LIST(token)}?${query}`);
  };

  const detail = (token: string, id: string): Promise<ApiResponse> => request(API.SALES_ORDER_DETAIL(token, id));

  const create = (token: string, payload: Record<string, any>): Promise<ApiResponse> =>
    request(API.SALES_ORDER_CREATE(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  const comment = (token: string, id: string, commentText: string): Promise<ApiResponse> =>
    request(API.SALES_ORDER_COMMENT(token, id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: commentText }),
    });

  const stats = (token: string): Promise<ApiResponse> => request(API.SALES_STATS(token));

  const products = (token: string, params: Record<string, any> = {}): Promise<ApiResponse> => {
    const query = toQueryString({
      search: params.search ?? '',
      page: params.page ?? 1,
      limit: params.limit ?? 12,
    });
    return request(`${API.SALES_PRODUCTS(token)}?${query}`);
  };

  const productDetail = (token: string, productId: string): Promise<ApiResponse> =>
    request(API.SALES_PRODUCT_DETAIL(token, productId));

  return {
    request,
    auth,
    login,
    list,
    detail,
    create,
    comment,
    stats,
    products,
    productDetail,
  };
}
