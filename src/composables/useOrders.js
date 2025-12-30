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
            const res = await fetch(API.MANAGE_ORDER_UPDATE(id), {
                method: 'POST',
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

    /**
     * 销售端: 验证并获取销售员信息
     */
    const checkSalesAuth = async (token) => {
        if (!token) return null;
        try {
            const res = await fetch(API.SALES_AUTH(token), { credentials: 'include' });
            const result = await res.json();
            return result.success ? result.data : null;
        } catch (e) {
            return null;
        }
    };

    /**
     * 销售端: 登录
     */
    const loginSales = async (token, password) => {
        try {
            const res = await fetch(API.SALES_AUTH(token), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password })
            });
            const result = await res.json();
            if (result.success) {
                return { success: true, data: result.data };
            }
            return { success: false, message: result.message || t('order.portal.passwordError') };
        } catch (e) {
            return { success: false, message: t('common.networkError') };
        }
    };

    /**
     * 销售端: 加载订单列表
     */
    const loadSalesOrders = async (token) => {
        if (!token) return;
        loading.value = true;
        try {
            const res = await fetch(API.SALES_ORDER_LIST(token), { credentials: 'include' });
            const result = await res.json();
            if (result.success) {
                orders.value = result.data.orders;
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
     * 销售端: 获取详情并标记为已读
     */
    const getSalesOrder = async (token, id) => {
        try {
            const res = await fetch(API.SALES_ORDER_DETAIL(token, id), { credentials: 'include' });
            const result = await res.json();
            if (result.success) {
                // 如果有新消息，异步标记为已读
                if (result.data.hasNewFeedback) {
                    fetch(API.SALES_ORDER_READ(token, id), {
                        method: 'PATCH',
                        credentials: 'include'
                    }).catch(e => console.warn('Mark read failed:', e));
                }
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
     * 销售端: 创建订单
     */
    const createSalesOrder = async (token, data) => {
        try {
            const { files, ...orderData } = data;
            const fileIds = [];

            // 处理文件上传
            if (files && files.length > 0) {
                for (const file of files) {
                    const formData = new FormData();
                    formData.append('file', file);
                    const uploadRes = await fetch(API.SALES_UPLOAD(token), {
                        method: 'POST',
                        body: formData,
                        credentials: 'include'
                    });
                    const uploadResult = await uploadRes.json();
                    if (uploadResult.success) {
                        fileIds.push(uploadResult.data.id);
                    }
                }
            }

            const res = await fetch(API.SALES_ORDER_CREATE(token), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ...orderData, fileIds })
            });
            const result = await res.json();
            if (result.success) {
                addToast({ message: t('order.portal.submitSuccess'), type: 'success' });
                return true;
            }
            addToast({ message: result.message, type: 'error' });
            return false;
        } catch (e) {
            addToast({ message: t('common.networkError'), type: 'error' });
            return false;
        }
    };

    /**
     * 销售端: 提交留言
     */
    const addSalesComment = async (token, id, comment) => {
        try {
            const res = await fetch(API.SALES_ORDER_COMMENT(token, id), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ comment })
            });
            const result = await res.json();
            if (result.success) {
                addToast({ message: result.message, type: 'success' });
                return true;
            }
            addToast({ message: result.message, type: 'error' });
            return false;
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
        addComment,
        // 销售端方法
        checkSalesAuth,
        loginSales,
        loadSalesOrders,
        getSalesOrder,
        createSalesOrder,
        addSalesComment
    };
}
