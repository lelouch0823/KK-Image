/**
 * 采购单 CRUD 操作
 * ==================
 * 封装创建、更新、状态变更、成本分摊等写操作。
 *
 * @module composables/purchase-order/usePurchaseOrderCrud
 */

import type { Ref } from 'vue';
import type { ApiResponse } from '../useResource';
import { API } from '@/utils/constants';
import { apiAction, type AddToastFn } from '@/utils/api-helpers';
import type {
  PurchaseOrder,
  PurchaseOrderDetail,
} from './purchase-order-types';

export interface PurchaseOrderCrudDeps {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  addToast: AddToastFn;
  t: (key: string, fallback?: string) => string;
  detail: Ref<PurchaseOrderDetail | null>;
  canWriteThroughDetail: (purchaseOrderId: string) => boolean;
}

export function usePurchaseOrderCrud({
  authFetch,
  addToast,
  t,
  detail,
  canWriteThroughDetail,
}: PurchaseOrderCrudDeps) {
  const createPO = async (data: Record<string, unknown>): Promise<PurchaseOrder | null> => {
    return apiAction<PurchaseOrder>(
      () => authFetch(API.MANAGE_PURCHASE_ORDERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
      { successMessage: t('purchaseOrder.toast.created'), addToast }
    );
  };

  const createFromOrders = async (orderIds: string[], poData: Record<string, unknown> = {}): Promise<PurchaseOrder | null> => {
    const uniqueOrderIds = [...new Set((orderIds || []).filter(Boolean))];
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_FROM_ORDERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: uniqueOrderIds, ...poData }),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({ message: t('purchaseOrder.toast.createdFromOrders'), type: 'success' });
        return json.data as PurchaseOrder;
      } else {
        addToast({ message: json.error || '', type: 'error' });
        return null;
      }
    } catch (e: unknown) {
      console.error('createFromOrders failed:', e);
      const err = e as Error;
      addToast({ message: err.message, type: 'error' });
      return null;
    }
  };

  const updatePO = async (id: string, updates: Record<string, unknown>): Promise<boolean> => {
    const result = await apiAction<PurchaseOrderDetail>(
      () => authFetch(API.MANAGE_PURCHASE_ORDER_BY_ID(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }),
      {
        successMessage: t('purchaseOrder.toast.updated'),
        addToast,
        onSuccess: (data) => {
          if (canWriteThroughDetail(id)) {
            detail.value = data;
          }
        },
      }
    );
    return result !== null;
  };

  const updateStatus = async (id: string, newStatus: string): Promise<boolean> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_STATUS(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        const data = json.data as { message?: string };
        addToast({
          message: data?.message || t('purchaseOrder.toast.statusUpdated'),
          type: 'success',
        });
        return true;
      } else {
        addToast({ message: json.error || '', type: 'error' });
        return false;
      }
    } catch (e: unknown) {
      console.error('updateStatus failed:', e);
      const err = e as Error;
      addToast({ message: err.message, type: 'error' });
      return false;
    }
  };

  const allocateCosts = async (poId: string): Promise<boolean> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_ALLOCATE(poId), {
        method: 'POST',
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        if (canWriteThroughDetail(poId)) {
          detail.value = json.data as PurchaseOrderDetail;
        }
        addToast({ message: t('purchaseOrder.toast.allocated'), type: 'success' });
        return true;
      }
      addToast({ message: json.error || '', type: 'error' });
      return false;
    } catch (e: unknown) {
      console.error('allocateCosts failed:', e);
      return false;
    }
  };

  return {
    createPO,
    createFromOrders,
    updatePO,
    updateStatus,
    allocateCosts,
  };
}
