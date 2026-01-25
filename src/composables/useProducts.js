
import { ref, reactive } from 'vue';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { API } from '@/utils/constants';

// Shared state (optional, but good for keeping list in sync)
const products = ref([]);
const loading = ref(false);
const error = ref(null);
const pagination = reactive({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
});

export function useProducts() {
    const { authFetch } = useAuth();
    const { addToast } = useToast();

    const loadProducts = async (params = {}) => {
        loading.value = true;
        error.value = null; // Reset error before fetch
        try {
            const query = new URLSearchParams({
                page: params.page || pagination.page,
                limit: params.limit || pagination.limit,
                ...params, // search, category, status
            });

            const res = await authFetch(`${API.MANAGE_PRODUCTS}?${query.toString()}`).then(r => r.json());

            if (res.success) {
                products.value = res.data || [];
                if (res.meta) {
                    pagination.page = res.meta.page;
                    pagination.limit = res.meta.limit;
                    pagination.total = res.meta.total;
                    pagination.totalPages = Math.ceil(res.meta.total / res.meta.limit) || 1;
                }
                return true;
            } else {
                error.value = res.error || 'Failed to load products';
                addToast({ message: error.value, type: 'error' });
                return false;
            }
        } catch (e) {
            console.error('loadProducts error:', e);
            error.value = e.message || 'Network Error';
            addToast({ message: error.value, type: 'error' });
            return false;
        } finally {
            loading.value = false;
        }
    };

    const createProduct = async (data) => {
        try {
            const res = await authFetch(API.MANAGE_PRODUCTS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).then(r => r.json());

            if (res.success) {
                addToast({ message: 'Product created successfully', type: 'success' });
                return res.data;
            } else {
                addToast({ message: res.error || 'Failed to create product', type: 'error' });
                return null;
            }
        } catch {
            addToast({ message: 'Network error', type: 'error' });
            return null;
        }
    };

    const updateProduct = async (id, updates) => {
        try {
            const res = await authFetch(API.MANAGE_PRODUCT_BY_ID(id), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            }).then(r => r.json());

            if (res.success) {
                addToast({ message: 'Product updated', type: 'success' });
                // Update local state immediately for better UX
                const idx = products.value.findIndex(p => p.id === id);
                if (idx !== -1) {
                    products.value[idx] = { ...products.value[idx], ...updates };
                }
                return true;
            } else {
                addToast({ message: res.error || 'Failed to update', type: 'error' });
                return false;
            }
        } catch (e) {
            addToast({ message: 'Network error', type: 'error' });
            return false;
        }
    };

    const deleteProduct = async (id) => {
        try {
            const res = await authFetch(API.MANAGE_PRODUCT_BY_ID(id), {
                method: 'DELETE',
            }).then(r => r.json());

            if (res.success) {
                addToast({ message: 'Product deleted', type: 'success' });
                products.value = products.value.filter(p => p.id !== id);
                pagination.total--;
                return true;
            } else {
                addToast({ message: res.error || 'Delete failed', type: 'error' });
                return false;
            }
        } catch (e) {
            addToast({ message: 'Network error', type: 'error' });
            return false;
        }
    };

    return {
        products,
        loading,
        pagination,
        error,
        loadProducts,
        createProduct,
        updateProduct,
        deleteProduct
    };
}
