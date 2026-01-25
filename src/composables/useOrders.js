/**
 * 订单 API 调用封装
 * @module composables/useOrders
 */
import { ref } from 'vue';
import { useResource } from './useResource';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { useI18n } from './useI18n';
import { API } from '@/utils/constants';

export function useOrders() {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const { t } = useI18n();

  // 使用 useResource 管理管理端订单列表
  const resource = useResource(API.MANAGE_ORDERS, {
    listPath: 'data.orders',
  });

  // 额外状态（Orders 特有）
  const salespersons = ref([]);
  const statuses = ref([]);

  /**
   * 加载管理端订单列表（增强版，提取额外数据）
   */
  const loadOrders = async (params = {}) => {
    // 复用 useResource 的状态管理，但自定义请求逻辑以获取 metadata
    // 取消之前的请求
    resource.abort();

    resource.loading.value = true;
    resource.error.value = null;

    try {
      const query = new URLSearchParams({
        page: params.page || resource.pagination.page,
        limit: params.limit || resource.pagination.limit,
        ...params,
      });

      // 过滤空参数
      const cleanParams = new URLSearchParams();
      for (const [key, value] of query) {
        if (value !== 'undefined' && value !== 'null' && value !== '') {
          cleanParams.append(key, value);
        }
      }

      // 使用自定义 fetch 获取完整响应
      const res = await authFetch(`${API.MANAGE_ORDERS}?${cleanParams.toString()}`).then(r => r.json());

      if (res.success) {
        // 更新列表数据
        resource.items.value = res.data.orders;

        // 提取额外数据
        salespersons.value = res.data.salespersons || [];
        statuses.value = res.data.statuses || [];

        // 更新分页
        if (res.data.pagination) {
          Object.assign(resource.pagination, res.data.pagination);
        }

        return true;
      } else {
        resource.error.value = res.message || t('common.loadFailed');
        addToast({ message: resource.error.value, type: 'error' });
        return false;
      }
    } catch (e) {
      if (e.name === 'AbortError') return false;
      resource.error.value = t('common.networkError');
      addToast({ message: resource.error.value, type: 'error' });
      return false;
    } finally {
      resource.loading.value = false;
    }
  };

  /**
   * 获取订单详情
   */
  const getOrder = async (id) => {
    try {
      const res = await authFetch(API.MANAGE_ORDER_BY_ID(id)).then(r => r.json());

      if (res.success) {
        return res.data;
      } else {
        addToast({ message: res.message, type: 'error' });
        return null;
      }
    } catch (_e) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return null;
    }
  };

  /**
   * 更新订单信息
   */
  const updateOrder = async (id, updates, reason, fileIds) => {
    const idx = resource.items.value.findIndex(item => item.id === id);
    const oldItem = idx !== -1 ? { ...resource.items.value[idx] } : null;

    // 乐观更新
    if (idx !== -1) {
      resource.items.value[idx] = { ...resource.items.value[idx], ...updates };
    }

    try {
      const body = { updates, reason };
      if (fileIds) body.fileIds = fileIds;

      const res = await authFetch(API.MANAGE_ORDER_UPDATE(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json());

      if (res.success) {
        addToast({ message: res.message || t('order.manage.editOrder'), type: 'success' });
        return true;
      } else {
        // 回滚
        if (idx !== -1 && oldItem) resource.items.value[idx] = oldItem;
        addToast({ message: res.message, type: 'error' });
        return false;
      }
    } catch (_e) {
      // 回滚
      if (idx !== -1 && oldItem) resource.items.value[idx] = oldItem;
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    }
  };

  /**
   * 变更订单状态
   */
  const changeStatus = async (id, status, note = '') => {
    const idx = resource.items.value.findIndex(item => item.id === id);
    const oldItem = idx !== -1 ? { ...resource.items.value[idx] } : null;

    // 乐观更新
    if (idx !== -1) {
      resource.items.value[idx].status = status;
    }

    try {
      const res = await authFetch(API.MANAGE_ORDER_STATUS(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      }).then(r => r.json());

      if (res.success) {
        addToast({ message: res.message, type: 'success' });
        return true;
      } else {
        // 回滚
        if (idx !== -1 && oldItem) resource.items.value[idx] = oldItem;
        addToast({ message: res.message, type: 'error' });
        return false;
      }
    } catch (_e) {
      // 回滚
      if (idx !== -1 && oldItem) resource.items.value[idx] = oldItem;
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    }
  };

  /**
   * 添加管理员留言
   */
  const addComment = async (id, comment) => {
    // 留言通常不需要乐观更新，因为不直接显示在列表的主要列中
    try {
      const res = await authFetch(API.MANAGE_ORDER_COMMENT(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      }).then(r => r.json());

      if (res.success) {
        addToast({ message: res.message, type: 'success' });
        return true;
      } else {
        addToast({ message: res.message, type: 'error' });
        return false;
      }
    } catch (_e) {
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
      const res = await authFetch(API.SALES_AUTH(token)).then(r => r.json());
      return res.success ? res.data : null;
    } catch (_e) {
      return null;
    }
  };

  /**
   * 销售端: 登录
   */
  const loginSales = async (token, password) => {
    try {
      const res = await authFetch(API.SALES_AUTH(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }).then(r => r.json());

      if (res.success) {
        return { success: true, data: res.data };
      }
      return { success: false, message: res.message || t('order.portal.passwordError') };
    } catch (_e) {
      return { success: false, message: t('common.networkError') };
    }
  };

  /**
   * 销售端: 加载订单列表
   */
  const loadSalesOrders = async (token) => {
    if (!token) return;
    resource.loading.value = true;
    try {
      const res = await authFetch(API.SALES_ORDER_LIST(token)).then(r => r.json());

      if (res.success) {
        resource.items.value = res.data.orders;
      } else {
        addToast({ message: res.message || t('common.loadFailed'), type: 'error' });
      }
    } catch (_e) {
      addToast({ message: t('common.networkError'), type: 'error' });
    } finally {
      resource.loading.value = false;
    }
  };

  /**
   * 销售端: 获取详情并标记为已读
   */
  const getSalesOrder = async (token, id) => {
    try {
      const res = await authFetch(API.SALES_ORDER_DETAIL(token, id)).then(r => r.json());

      if (res.success) {
        // SOTA: Auto-read handled by backend GET request
        return res.data;
      } else {
        addToast({ message: res.message, type: 'error' });
        return null;
      }
    } catch (_e) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return null;
    }
  };

  /**
   * 销售端: 创建订单 (先创建订单，再上传图片)
   * @param {string} token - 销售访问令牌
   * @param {Object} data - 订单数据
   * @param {Function} onProgress - 进度回调 (step, current, total)
   */
  const createSalesOrder = async (token, data, onProgress = () => { }) => {
    try {
      // OrderForm 已在提交前通过 ImageUploader 完成上传，直接使用 fileIds
      const { fileIds = [], ...orderData } = data;

      onProgress('creating', 0, 0);

      const res = await authFetch(API.SALES_ORDER_CREATE(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderData, fileIds }),
      }).then(r => r.json());

      if (!res.success) {
        addToast({ message: res.message, type: 'error' });
        return false;
      }

      onProgress('done', 0, 0);
      addToast({ message: t('order.portal.submitSuccess'), type: 'success' });
      return true;
    } catch (_e) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    }
  };

  /**
   * 销售端: 提交留言
   */
  const addSalesComment = async (token, id, comment) => {
    try {
      const res = await authFetch(API.SALES_ORDER_COMMENT(token, id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      }).then(r => r.json());

      if (res.success) {
        addToast({ message: res.message, type: 'success' });
        return true;
      }
      addToast({ message: res.message, type: 'error' });
      return false;
    } catch (_e) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    }
  };

  /**
   * 复制订单 (获取订单详情并返回可用于预填充的表单数据)
   * @param {string} token - 销售访问令牌
   * @param {string} orderId - 要复制的订单 ID
   * @returns {Object|null} 可用于预填充的表单数据
   */
  const duplicateOrder = async (token, orderId) => {
    try {
      const order = await getSalesOrder(token, orderId);
      if (!order) return null;

      const currentData = order.currentData || {};

      // 返回可用于预填充表单的数据
      return {
        name: currentData.name || '',
        brand: currentData.brand || '',
        series: currentData.series || '',
        size: currentData.size || '',
        color: currentData.color || '',
        material: currentData.material || '',
        remark: currentData.remark || '',
        deadline: '', // 不复制截止日期，让用户重新选择
      };
    } catch (_e) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return null;
    }
  };

  /**
   * 批量操作订单
   * @param {string[]} ids - 订单 ID 列表
   * @param {'confirm'|'reject'|'void'} action - 操作类型
   * @param {string} reason - 操作理由 (可选)
   * @returns {Object|null} 操作结果
   */
  const batchAction = async (ids, action, reason = '') => {
    try {
      const res = await authFetch(API.MANAGE_ORDER_BATCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, reason }),
      }).then(r => r.json());

      if (res.success) {
        addToast({ message: res.message, type: 'success' });
        return res.data;
      } else {
        addToast({ message: res.message, type: 'error' });
        return null;
      }
    } catch (_e) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return null;
    }
  };

  return {
    loading: resource.loading,
    orders: resource.items,
    salespersons,
    statuses,
    pagination: resource.pagination,
    error: resource.error,
    loadOrders,
    getOrder,
    updateOrder,
    changeStatus,
    addComment,
    batchAction,
    // 销售端方法
    checkSalesAuth,
    loginSales,
    loadSalesOrders,
    getSalesOrder,
    createSalesOrder,
    addSalesComment,
    duplicateOrder,
  };
}
