/**
 * 订单 API 调用封装
 * @module composables/useOrders
 */
import { ref } from 'vue';
import { useResource } from './useResource';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { useI18n } from './useI18n';
import { useSalesOrderApi } from '@/composables/sales/useSalesOrderApi';
import { API, SALES_ORDER_PAGE_SIZE } from '@/utils/constants';
import { handleApiError } from '@/utils/api-helpers';

// ============================================================
// 全局共享状态 (Single Source of Truth)
// ============================================================
const sharedResource = useResource(API.MANAGE_ORDERS);
const sharedSalesResource = useResource('/api/sales/__shared__/orders', {
  cache: false,
});
const salespersons = ref<any[]>([]);
const statuses = ref<any[]>([]);
const procurementStatuses = ref<any[]>([]);
const deliveryStatuses = ref<any[]>([]);
let manageListRequestId = 0;
let salesListRequestId = 0;

export function useOrders() {
  const { authFetch } = useAuth();
  const salesOrderApi = useSalesOrderApi();
  const { addToast } = useToast();
  const { t } = useI18n();

  // 使用共享资源
  const resource = sharedResource;
  const salesResource = sharedSalesResource;

  /**
   * 加载管理端订单列表（增强版，提取额外数据）
   * @param params - 查询参数
   * @param append - 是否追加到现有列表（用于无限滚动）
   */
  const loadOrders = async (params: Record<string, any> = {}, append: boolean = false): Promise<boolean> => {
    const requestId = ++manageListRequestId;
    // 复用 useResource 的状态管理，但自定义请求逻辑以获取 metadata
    // 取消之前的请求
    resource.abort();

    resource.loading.value = true;
    resource.error.value = null;
    resource.errorCode.value = null;

    const MAX_ITEMS = 200; // 限制列表最大长度，防止 OOM

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
      const res: any = await authFetch(`${API.MANAGE_ORDERS}?${cleanParams.toString()}`).then(r => r.json());
      if (requestId !== manageListRequestId) {
        return false;
      }

      if (res.success) {
        // 追加模式：合并新数据，限制最大长度
        if (append) {
          const combined = [...resource.items.value, ...res.data];
          resource.items.value = combined.length > MAX_ITEMS
            ? combined.slice(-MAX_ITEMS)
            : combined;
        } else {
          // 替换模式：直接赋值
          resource.items.value = res.data;
        }

        // 提取额外数据（元数据几乎不随分页变化，仅在缺失时加载）
        if (res.salespersons && salespersons.value.length === 0) {
          salespersons.value = res.salespersons;
        }
        if (res.statuses && statuses.value.length === 0) {
          statuses.value = res.statuses;
        }
        if (res.procurementStatuses && procurementStatuses.value.length === 0) {
          procurementStatuses.value = res.procurementStatuses;
        }
        if (res.deliveryStatuses && deliveryStatuses.value.length === 0) {
          deliveryStatuses.value = res.deliveryStatuses;
        }

        // Update pagination
        if (res.pagination) {
          Object.assign(resource.pagination, res.pagination);
        }

        // Ensure totalPages is valid
        if (resource.pagination.totalPages < 1) resource.pagination.totalPages = 1;

        return true;
      } else {
        resource.error.value = res.message || t('common.loadFailed');
        resource.errorCode.value = 'BUSINESS_ERROR';
        addToast({ message: resource.error.value, type: 'error' });
        return false;
      }
    } catch (e: any) {
      if (requestId !== manageListRequestId) {
        return false;
      }
      if (e.name === 'AbortError') return false;
      const { code, message } = handleApiError(e, { t, addToast, fallbackKey: 'common.networkError' });
      resource.errorCode.value = code;
      resource.error.value = message;
      return false;
    } finally {
      if (requestId === manageListRequestId) {
        resource.loading.value = false;
      }
    }
  };

  /**
   * 获取订单详情
   */
  const getOrder = async (id: string): Promise<any> => {
    try {
      const res: any = await authFetch(API.MANAGE_ORDER_BY_ID(id)).then(r => r.json());

      if (res.success) {
        return res.data;
      } else {
        addToast({ message: res.message, type: 'error' });
        return null;
      }
    } catch (_e: any) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return null;
    }
  };

  /**
   * 更新订单信息
   */
  const updateOrder = async (id: string, updates: Record<string, any>, reason?: string, fileIds?: string[], productId?: string, variantId?: string): Promise<boolean> => {
    const idx = resource.items.value.findIndex(item => item.id === id);
    const oldItem = idx !== -1 ? { ...resource.items.value[idx] } : null;

    // 乐观更新
    if (idx !== -1) {
      resource.items.value[idx] = { ...resource.items.value[idx], ...updates };
    }

    try {
      const body: Record<string, any> = { updates, reason };
      if (fileIds) body.fileIds = fileIds;
      if (productId !== undefined) body.productId = productId;
      if (variantId !== undefined) body.variantId = variantId;

      const res: any = await authFetch(API.MANAGE_ORDER_UPDATE(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json());

      if (res.success) {
        if (idx !== -1 && res.data) {
          resource.items.value[idx] = res.data;
        }
        addToast({ message: res.message || t('order.manage.editOrder'), type: 'success' });
        return true;
      } else {
        // 回滚
        if (idx !== -1 && oldItem) resource.items.value[idx] = oldItem;
        addToast({ message: res.message, type: 'error' });
        return false;
      }
    } catch (_e: any) {
      // 回滚
      if (idx !== -1 && oldItem) resource.items.value[idx] = oldItem;
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    }
  };

  /**
   * 变更订单状态
   */
  const changeStatus = async (id: string, status: string, note: string = '', force: boolean = false): Promise<boolean> => {
    const idx = resource.items.value.findIndex(item => item.id === id);
    const oldItem = idx !== -1 ? { ...resource.items.value[idx] } : null;

    // 乐观更新
    if (idx !== -1) {
      resource.items.value[idx].status = status;
    }

    try {
      const res: any = await authFetch(API.MANAGE_ORDER_STATUS(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note, force: Boolean(force) }),
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
    } catch (_e: any) {
      // 回滚
      if (idx !== -1 && oldItem) resource.items.value[idx] = oldItem;
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    }
  };

  const runOrderLineCommand = async (path: string, payload: Record<string, any>, successMessage: string): Promise<boolean> => {
    try {
      const res: any = await authFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json());

      if (res.success) {
        addToast({ message: res.message || successMessage, type: 'success' });
        return true;
      }

      addToast({ message: res.error || res.message || t('common.operationFailed'), type: 'error' });
      return false;
    } catch (_e: any) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    }
  };

  const reserveOrderLine = async (orderId: string, lineId: string, quantity: number): Promise<boolean> => runOrderLineCommand(
    API.MANAGE_ORDER_LINE_RESERVE(orderId, lineId),
    { quantity },
    t('order.detail.reserveSuccess', '预留成功')
  );

  const releaseOrderLine = async (orderId: string, lineId: string, quantity: number): Promise<boolean> => runOrderLineCommand(
    API.MANAGE_ORDER_LINE_RELEASE(orderId, lineId),
    { quantity },
    t('order.detail.releaseSuccess', '释放成功')
  );

  const shipOrderLine = async (orderId: string, lineId: string, quantity: number): Promise<boolean> => runOrderLineCommand(
    API.MANAGE_ORDER_LINE_SHIP(orderId, lineId),
    { quantity },
    t('order.detail.shipSuccess', '出货成功')
  );

  const unshipOrderLine = async (orderId: string, lineId: string, quantity: number): Promise<boolean> => runOrderLineCommand(
    API.MANAGE_ORDER_LINE_UNSHIP(orderId, lineId),
    { quantity },
    t('order.detail.unshipSuccess', '撤销出货成功')
  );

  const returnOrderLine = async (orderId: string, lineId: string, payload: number | { quantity: number; reason?: string; note?: string }): Promise<boolean> => {
    const normalizedPayload =
      typeof payload === 'number'
        ? { quantity: payload }
        : {
            quantity: Number(payload?.quantity || 0),
            reason: payload?.reason || '',
            note: payload?.note || '',
          };

    return runOrderLineCommand(
      API.MANAGE_ORDER_LINE_RETURN(orderId, lineId),
      normalizedPayload,
      t('order.detail.returnSuccess', '退回入库成功')
    );
  };

  const confirmOrderDelivery = async (orderId: string, note: string = ''): Promise<boolean> => {
    try {
      const res: any = await authFetch(API.MANAGE_ORDER_DELIVERY_CONFIRM(orderId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      }).then(r => r.json());

      if (res.success) {
        addToast({
          message: res.message || t('order.detail.deliveryConfirmSuccess', '签收确认成功'),
          type: 'success',
        });
        return true;
      }

      addToast({ message: res.error || res.message || t('common.operationFailed'), type: 'error' });
      return false;
    } catch (_e: any) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    }
  };

  /**
   * 添加管理员留言
   */
  const addComment = async (id: string, comment: string): Promise<boolean> => {
    // 留言通常不需要乐观更新，因为不直接显示在列表的主要列中
    try {
      const res: any = await authFetch(API.MANAGE_ORDER_COMMENT(id), {
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
    } catch (_e: any) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    }
  };

  /**
   * 销售端: 验证并获取销售员信息
   */
  const checkSalesAuth = async (token: string): Promise<any> => {
    if (!token) return null;
    const result = await salesOrderApi.auth(token);
    return result.ok ? result.data : null;
  };

  /**
   * 销售端: 登录
   */
  const loginSales = async (token: string, password: string): Promise<any> => {
    const result = await salesOrderApi.login(token, password);
    if (result.ok) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      message: result.error || t('order.portal.passwordError'),
    };
  };

  /**
   * 销售端: 加载订单列表
   */
  const loadSalesOrders = async (token: string, page: number = 1, append: boolean = false, search: string = ''): Promise<boolean> => {
    if (!token) return false;
    const requestId = ++salesListRequestId;
    if (!append) {
      salesResource.loading.value = true;
    }
    salesResource.error.value = null;
    salesResource.errorCode.value = null;

    const MAX_ITEMS = 100; // 限制列表最大长度，防止 OOM

    const result = await salesOrderApi.list(token, {
      page,
      limit: SALES_ORDER_PAGE_SIZE,
      search,
    });
    if (requestId !== salesListRequestId) {
      return false;
    }

    if (result.ok) {
      const nextOrders = Array.isArray(result.data) ? result.data : [];
      if (append) {
        const combined = [...salesResource.items.value, ...nextOrders];
        salesResource.items.value = combined.length > MAX_ITEMS
          ? combined.slice(-MAX_ITEMS)
          : combined;
      } else {
        salesResource.items.value = nextOrders;
      }

      if (result.pagination) {
        Object.assign(salesResource.pagination, result.pagination);
      }
      salesResource.loading.value = false;
      return true;
    } else {
      salesResource.error.value = result.error || t('common.loadFailed');
      addToast({ message: salesResource.error.value, type: 'error' });
      salesResource.loading.value = false;
      return false;
    }
  };

  /**
   * 销售端: 获取详情并标记为已读
   */
  const getSalesOrder = async (token: string, id: string): Promise<any> => {
    const result = await salesOrderApi.detail(token, id);
    if (result.ok) {
      return result.data;
    }
    addToast({ message: result.error || t('common.networkError'), type: 'error' });
    return null;
  };

  /**
   * 销售端: 创建订单 (先创建订单，再上传图片)
   * @param token - 销售访问令牌
   * @param data - 订单数据
   * @param onProgress - 进度回调 (step, current, total)
   */
  const createSalesOrder = async (token: string, data: Record<string, any>, onProgress: (step: string, current: number, total: number) => void = () => {}): Promise<any> => {
    // OrderForm 已在提交前通过 ImageUploader 完成上传，直接使用 fileIds
    const { fileIds = [], ...orderData } = data;
    const payload = { ...orderData, fileIds };

    onProgress('creating', 0, 0);
    const result = await salesOrderApi.create(token, payload);

    if (!result.ok) {
      const message = result.error || t('common.networkError');
      addToast({ message, type: 'error' });
      return {
        ok: false,
        error: message,
      };
    }

    onProgress('done', 0, 0);
    addToast({ message: t('order.portal.submitSuccess'), type: 'success' });
    return {
      ok: true,
      error: null,
      data: result.data ?? null,
    };
  };

  /**
   * 销售端: 提交留言
   */
  const addSalesComment = async (token: string, id: string, comment: string): Promise<boolean> => {
    const result = await salesOrderApi.comment(token, id, comment);
    if (result.ok) {
      addToast({ message: t('common.saved') || 'Saved', type: 'success' });
      return true;
    }
    addToast({ message: result.error || t('common.networkError'), type: 'error' });
    return false;
  };

  /**
   * 批量操作订单
   * @param ids - 订单 ID 列表
   * @param action - 操作类型
   * @param reason - 操作理由 (可选)
   * @returns 操作结果
   */
  const batchAction = async (ids: string[], action: 'confirm' | 'reject' | 'void', reason: string = ''): Promise<any> => {
    try {
      const res: any = await authFetch(API.MANAGE_ORDER_BATCH, {
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
    } catch (_e: any) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return null;
    }
  };

  return {
    loading: resource.loading,
    orders: resource.items,
    salesLoading: salesResource.loading,
    salesOrders: salesResource.items,
    salespersons,
    statuses,
    procurementStatuses,
    deliveryStatuses,
    pagination: resource.pagination,
    salesPagination: salesResource.pagination,
    error: resource.error,
    errorCode: resource.errorCode,
    salesError: salesResource.error,
    salesErrorCode: salesResource.errorCode,
    loadOrders,
    getOrder,
    updateOrder,
    reserveOrderLine,
    releaseOrderLine,
    shipOrderLine,
    unshipOrderLine,
    returnOrderLine,
    confirmOrderDelivery,
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
  };
}
