/**
 * 订单 API 调用封装
 * @module composables/useOrders
 */
import { ref } from 'vue';
import { useToast } from './useToast';
import { useI18n } from './useI18n';
import { API } from '@/utils/constants';

export function useOrders() {
    const { addToast } = useToast();
    const { t } = useI18n();

    const loading = ref(false);
    const orders = ref([]);
    const salespersons = ref([]);
    const statuses = ref([]);
    const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 });

    /**
     * 加载管理端订单列表
     */
    const loadOrders = async (params = {}) => {
        loading.value = true;
        try {
            const query = new URLSearchParams();
            if (params.page) query.set('page', params.page);
            if (params.limit) query.set('limit', params.limit);
            if (params.salesperson) query.set('salesperson', params.salesperson);
            if (params.status) query.set('status', params.status);
            if (params.search) query.set('search', params.search);

            const url = `${API.MANAGE_ORDERS}?${query.toString()}`;
            const res = await fetch(url, { credentials: 'include' });
            const result = await res.json();

            if (result.success) {
                orders.value = result.data.orders;
                salespersons.value = result.data.salespersons || [];
                statuses.value = result.data.statuses || [];
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
     * 获取订单详情
     */
    const getOrder = async (id) => {
        try {
            const res = await fetch(API.MANAGE_ORDER_BY_ID(id), { credentials: 'include' });
            const result = await res.json();

            if (result.success) {
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
     * 更新订单信息
     */
    const updateOrder = async (id, updates, reason) => {
        try {
            const res = await fetch(API.MANAGE_ORDER_BY_ID(id), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ updates, reason })
            });
            const result = await res.json();

            if (result.success) {
                addToast({ message: result.message || t('order.manage.editOrder'), type: 'success' });
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
     * 变更订单状态
     */
    const changeStatus = async (id, status, note = '') => {
        try {
            const res = await fetch(API.MANAGE_ORDER_STATUS(id), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status, note })
            });
            const result = await res.json();

            if (result.success) {
                addToast({ message: result.message, type: 'success' });
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
     * 添加管理员留言
     */
    const addComment = async (id, comment) => {
        try {
            const res = await fetch(API.MANAGE_ORDER_COMMENT(id), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ comment })
            });
            const result = await res.json();

            if (result.success) {
                addToast({ message: result.message, type: 'success' });
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

    return {
        loading,
        orders,
        salespersons,
        statuses,
        pagination,
        loadOrders,
        getOrder,
        updateOrder,
        changeStatus,
        addComment
    };
}
