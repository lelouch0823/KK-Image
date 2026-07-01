import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';
import type { PaginationMeta } from '@/composables/useResource';
import { API } from '@/utils/constants';
import { classifyError, extractErrorMessage } from '@/utils/api-helpers';

/** 销售产品接口 */
interface SalesProduct {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  image?: string;
  [key: string]: unknown;
}

/** 加载结果接口 */
interface LoadResult {
  ok: boolean;
  items: SalesProduct[];
  meta: PaginationMeta;
  error: string | null;
  stale?: boolean;
}

/** API 响应结构 */
interface SalesProductsApiResponse {
  success: boolean;
  data?: SalesProduct[];
  pagination?: PaginationMeta;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export function useSalesProducts() {
  const { authFetch } = useAuth();
  const products = ref<SalesProduct[]>([]);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const errorCode = ref<string | null>(null);
  const meta = ref<PaginationMeta>({ total: 0, page: 1, limit: 12 });
  const lastQuery = ref<Record<string, unknown>>({ search: '', page: 1, limit: 12 });
  let listRequestId = 0;

  const loadSalesProducts = async (token: string, { search = '', page = 1, limit = 12 }: Record<string, unknown> = {}): Promise<LoadResult> => {
    if (!token) return { items: [], meta: { total: 0, page: 1, limit: 12 }, ok: false, error: null };
    const requestId = ++listRequestId;
    loading.value = true;
    error.value = null;
    errorCode.value = null;
    lastQuery.value = { search, page, limit };
    try {
      const query = new URLSearchParams({
        search: String(search || ''),
        page: String(page || 1),
        limit: String(limit || 12),
      });
      const res: SalesProductsApiResponse = await authFetch(`${API.SALES_PRODUCTS(token)}?${query.toString()}`).then((r) => r.json());
      if (requestId !== listRequestId) {
        return { ok: false, items: products.value, meta: meta.value, error: null, stale: true };
      }
      if (res.success) {
        products.value = Array.isArray(res.data) ? res.data : [];
        meta.value = res.pagination || { total: products.value.length, page: 1, limit: Number(limit || 12) };
        return { ok: true, items: products.value, meta: meta.value, error: null };
      }
      error.value = res.error || res.message || 'Load products failed';
      products.value = [];
      return {
        ok: false,
        items: [],
        meta: { total: 0, page: 1, limit: Number(limit || 12) },
        error: error.value,
      };
    } catch (e: unknown) {
      if (requestId !== listRequestId) {
        return { ok: false, items: products.value, meta: meta.value, error: null, stale: true };
      }
      errorCode.value = classifyError(e);
      error.value = extractErrorMessage(e, 'Load products failed');
      products.value = [];
      return {
        ok: false,
        items: [],
        meta: { total: 0, page: 1, limit: Number(limit || 12) },
        error: error.value,
      };
    } finally {
      if (requestId === listRequestId) {
        loading.value = false;
      }
    }
  };

  const retryLoadSalesProducts = async (token: string): Promise<LoadResult> => loadSalesProducts(token, lastQuery.value);

  const loadSalesProduct = async (token: string, productId: string): Promise<SalesProduct | null> => {
    if (!token || !productId) return null;
    error.value = null;
    errorCode.value = null;
    try {
      const res: SalesProductsApiResponse = await authFetch(API.SALES_PRODUCT_DETAIL(token, productId)).then((r) => r.json());
      if (res.success && res.data && !Array.isArray(res.data)) return res.data as SalesProduct;
      error.value = res.error || res.message || 'Load product failed';
      return null;
    } catch (e: unknown) {
      errorCode.value = classifyError(e);
      error.value = extractErrorMessage(e, 'Load product failed');
      return null;
    }
  };

  return {
    products,
    loading,
    error,
    errorCode,
    meta,
    loadSalesProducts,
    retryLoadSalesProducts,
    loadSalesProduct,
  };
}
