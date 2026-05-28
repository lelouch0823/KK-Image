import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';

export function useSalesProducts() {
  const { authFetch } = useAuth();
  const products = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const meta = ref({ total: 0, page: 1, limit: 12 });
  const lastQuery = ref({ search: '', page: 1, limit: 12 });
  let listRequestId = 0;

  const loadSalesProducts = async (token, { search = '', page = 1, limit = 12 } = {}) => {
    if (!token) return { items: [], meta: { total: 0, page: 1, limit: 12 } };
    const requestId = ++listRequestId;
    loading.value = true;
    error.value = null;
    lastQuery.value = { search, page, limit };
    try {
      const query = new URLSearchParams({
        search: String(search || ''),
        page: String(page || 1),
        limit: String(limit || 12),
      });
      const res = await authFetch(`${API.SALES_PRODUCTS(token)}?${query.toString()}`).then((r) => r.json());
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
    } catch (e) {
      if (requestId !== listRequestId) {
        return { ok: false, items: products.value, meta: meta.value, error: null, stale: true };
      }
      error.value = e.message || 'Load products failed';
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

  const retryLoadSalesProducts = async (token) => loadSalesProducts(token, lastQuery.value);

  const loadSalesProduct = async (token, productId) => {
    if (!token || !productId) return null;
    error.value = null;
    try {
      const res = await authFetch(API.SALES_PRODUCT_DETAIL(token, productId)).then((r) => r.json());
      if (res.success) return res.data;
      error.value = res.error || res.message || 'Load product failed';
      return null;
    } catch (e) {
      error.value = e?.message || 'Load product failed';
      return null;
    }
  };

  return {
    products,
    loading,
    error,
    meta,
    loadSalesProducts,
    retryLoadSalesProducts,
    loadSalesProduct,
  };
}
