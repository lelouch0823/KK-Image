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
      if (params.startTime) query.set('startTime', params.startTime);
      if (params.endTime) query.set('endTime', params.endTime);

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
    } catch (_e) {
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
    } catch (_e) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return null;
    }
  };

  /**
   * 更新订单信息
   */
  const updateOrder = async (id, updates, reason, fileIds) => {
    try {
      const body = { updates, reason };
      if (fileIds) body.fileIds = fileIds;

      const res = await fetch(API.MANAGE_ORDER_UPDATE(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const result = await res.json();

      if (result.success) {
        addToast({ message: result.message || t('order.manage.editOrder'), type: 'success' });
        return true;
      } else {
        addToast({ message: result.message, type: 'error' });
        return false;
      }
    } catch (_e) {
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
        body: JSON.stringify({ status, note }),
      });
      const result = await res.json();

      if (result.success) {
        addToast({ message: result.message, type: 'success' });
        return true;
      } else {
        addToast({ message: result.message, type: 'error' });
        return false;
      }
    } catch (_e) {
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
        body: JSON.stringify({ comment }),
      });
      const result = await res.json();

      if (result.success) {
        addToast({ message: result.message, type: 'success' });
        return true;
      } else {
        addToast({ message: result.message, type: 'error' });
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
      const res = await fetch(API.SALES_AUTH(token), { credentials: 'include' });
      const result = await res.json();
      return result.success ? result.data : null;
    } catch (_e) {
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
        body: JSON.stringify({ password }),
      });
      const result = await res.json();
      if (result.success) {
        return { success: true, data: result.data };
      }
      return { success: false, message: result.message || t('order.portal.passwordError') };
    } catch (_e) {
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
    } catch (_e) {
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
        // SOTA: Auto-read handled by backend GET request
        return result.data;
      } else {
        addToast({ message: result.message, type: 'error' });
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
      const { files, existingFileIds = [], ...orderData } = data;

      // Step 1: 创建订单 (如果有已有文件ID，直接传入)
      onProgress('creating', 0, files?.length || 0);

      const res = await fetch(API.SALES_ORDER_CREATE(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...orderData, fileIds: existingFileIds }),
      });
      const result = await res.json();

      if (!result.success) {
        addToast({ message: result.message, type: 'error' });
        return false;
      }

      const { id: orderId, orderNo: _orderNo } = result.data;

      // Step 2: 上传新图片 (带 orderId，直接归档)
      const newFileIds = [];
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          onProgress('uploading', i + 1, files.length);

          const formData = new FormData();
          formData.append('file', files[i]);

          // 带上 orderId 参数，后端会直接归档到订单文件夹
          const uploadRes = await fetch(`${API.SALES_UPLOAD(token)}?orderId=${orderId}`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });
          const uploadResult = await uploadRes.json();
          if (uploadResult.success) {
            newFileIds.push(uploadResult.data.id);
          }
        }
      }

      // Step 3: 如果有新上传的图片，追加到订单
      if (newFileIds.length > 0) {
        onProgress('linking', 0, 0);

        // 合并已有文件ID和新上传的文件ID
        const allFileIds = [...existingFileIds, ...newFileIds];
        const patchRes = await fetch(API.SALES_ORDER_DETAIL(token, orderId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            updates: {
              fileIds: allFileIds,
              reason: t('order.history.reason.initialUpload') || 'Initial upload'
            }
          }),
        });

        const patchResult = await patchRes.json();
        if (!patchResult.success) {
          console.error('Link files failed:', patchResult);
          // 不中断流程，但提示用户? 或者抛出错误
          // 鉴于订单已创建，图片已上传，只是关联失败。
          // 暂不抛出错误，但记录日志。
        }
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
      const res = await fetch(API.SALES_ORDER_COMMENT(token, id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comment }),
      });
      const result = await res.json();
      if (result.success) {
        addToast({ message: result.message, type: 'success' });
        return true;
      }
      addToast({ message: result.message, type: 'error' });
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
      const res = await fetch(API.MANAGE_ORDER_BATCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids, action, reason }),
      });
      const result = await res.json();

      if (result.success) {
        addToast({ message: result.message, type: 'success' });
        return result.data;
      } else {
        addToast({ message: result.message, type: 'error' });
        return null;
      }
    } catch (_e) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return null;
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
