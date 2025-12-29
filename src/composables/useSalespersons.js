/**
 * 销售人员管理 API 封装
 * @module composables/useSalespersons
 */
import { ref } from 'vue';
import { useToast } from './useToast';
import { useI18n } from './useI18n';
import { API } from '@/utils/constants';

export function useSalespersons() {
    const { addToast } = useToast();
    const { t } = useI18n();

    const loading = ref(false);
    const salespersons = ref([]);
    const pagination = ref({ page: 1, limit: 50, total: 0, totalPages: 0 });

    /**
     * 加载销售列表
     */
    const loadSalespersons = async (params = {}) => {
        loading.value = true;
        try {
            const query = new URLSearchParams();
            if (params.page) query.set('page', params.page);
            if (params.limit) query.set('limit', params.limit);
            if (params.search) query.set('search', params.search);

            const url = `${API.SALESPERSONS}?${query.toString()}`;
            const res = await fetch(url, { credentials: 'include' });
            const result = await res.json();

            if (result.success) {
                salespersons.value = result.data.salespersons;
                pagination.value = result.data.pagination;
            } else {
                addToast({ message: result.message || t('common.loadFailed'), type: 'error' });
            }
        } catch (e) {
            addToast({ message: t('common.networkError'), type: 'error' });
        } finally {
            loading.value = false;
        }
    };

    /**
     * 创建销售
     */
    const createSalesperson = async (data) => {
        try {
            const res = await fetch(API.SALESPERSONS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if (result.success) {
                addToast({ message: t('salesperson.createSuccess'), type: 'success' });
                return result.data;
            } else {
                addToast({ message: result.message, type: 'error' });
                return null;
            }
        } catch (e) {
            addToast({ message: t('common.networkError'), type: 'error' });
            return null;
        }
    };

    /**
     * 更新销售
     */
    const updateSalesperson = async (id, data) => {
        try {
            const res = await fetch(API.SALESPERSON_BY_ID(id), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if (result.success) {
                addToast({ message: t('salesperson.updateSuccess'), type: 'success' });
                return true;
            } else {
                addToast({ message: result.message, type: 'error' });
                return false;
            }
        } catch (e) {
            addToast({ message: t('common.networkError'), type: 'error' });
            return false;
        }
    };

    /**
     * 删除销售
     */
    const deleteSalesperson = async (id) => {
        try {
            const res = await fetch(API.SALESPERSON_BY_ID(id), {
                method: 'DELETE',
                credentials: 'include'
            });
            const result = await res.json();

            if (result.success) {
                addToast({ message: t('salesperson.deleteSuccess'), type: 'success' });
                return true;
            } else {
                addToast({ message: result.message, type: 'error' });
                return false;
            }
        } catch (e) {
            addToast({ message: t('common.networkError'), type: 'error' });
            return false;
        }
    };

    /**
     * 重置访问链接
     */
    const resetToken = async (id) => {
        try {
            const res = await fetch(API.SALESPERSON_RESET_TOKEN(id), {
                method: 'POST',
                credentials: 'include'
            });
            const result = await res.json();

            if (result.success) {
                addToast({ message: t('salesperson.linkReset'), type: 'success' });
                return result.data;
            } else {
                addToast({ message: result.message, type: 'error' });
                return null;
            }
        } catch (e) {
            addToast({ message: t('common.networkError'), type: 'error' });
            return null;
        }
    };

    /**
     * 复制访问链接
     */
    const copyAccessLink = async (accessToken) => {
        try {
            const url = `${window.location.origin}/sales/${accessToken}`;
            await navigator.clipboard.writeText(url);
            addToast({ message: t('salesperson.linkCopied'), type: 'success' });
            return true;
        } catch (e) {
            addToast({ message: t('common.copyFailed'), type: 'error' });
            return false;
        }
    };

    return {
        loading,
        salespersons,
        pagination,
        loadSalespersons,
        createSalesperson,
        updateSalesperson,
        deleteSalesperson,
        resetToken,
        copyAccessLink
    };
}
