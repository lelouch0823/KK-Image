/**
 * 采购单明细与收货操作
 * =====================
 * 封装明细增删改、收货登记、收货冲销、缺口关闭等操作。
 *
 * @module composables/purchase-order/usePurchaseOrderItems
 */

import type { ApiResponse } from '../useResource';
import { API } from '@/utils/constants';
import { buildPurchaseOrderIdempotentJsonHeaders } from '@/utils/purchase-order-request';
import { apiAction, type AddToastFn } from '@/utils/api-helpers';
import type {
  AddItemsPayload,
  RecordReceiptsPayload,
  CloseShortagesPayload,
} from './purchase-order-types';

export interface PurchaseOrderItemsDeps {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  addToast: AddToastFn;
  t: (key: string, fallback?: string) => string;
}

export function usePurchaseOrderItems({
  authFetch,
  addToast,
  t,
}: PurchaseOrderItemsDeps) {
  const addItems = async (poId: string, items: AddItemsPayload[]): Promise<boolean> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_ITEMS(poId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({ message: t('purchaseOrder.toast.itemsAdded'), type: 'success' });
        return true;
      }
      addToast({ message: json.error || '', type: 'error' });
      return false;
    } catch (e: unknown) {
      console.error('addItems failed:', e);
      return false;
    }
  };

  const updateItem = async (poId: string, itemId: string, updates: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_ITEM(poId, itemId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.itemUpdated') || '明细已更新',
          type: 'success',
        });
        return true;
      }
      addToast({ message: json.error || '', type: 'error' });
      return false;
    } catch (e: unknown) {
      console.error('updateItem failed:', e);
      return false;
    }
  };

  const removeItem = async (poId: string, itemId: string): Promise<boolean> => {
    const result = await apiAction(
      () => authFetch(API.MANAGE_PURCHASE_ORDER_ITEM(poId, itemId), {
        method: 'DELETE',
      }),
      { successMessage: t('purchaseOrder.toast.itemRemoved'), addToast }
    );
    return result !== null;
  };

  const recordReceipts = async (poId: string, payload: RecordReceiptsPayload): Promise<unknown> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_RECEIPTS(poId), {
        method: 'POST',
        headers: buildPurchaseOrderIdempotentJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.receiptsRecorded') || '收货已登记',
          type: 'success',
        });
        return json.data;
      }
      addToast({ message: json.error || '', type: 'error' });
      return null;
    } catch (e: unknown) {
      console.error('recordReceipts failed:', e);
      const err = e as Error;
      addToast({ message: err.message, type: 'error' });
      return null;
    }
  };

  const reverseReceipt = async (poId: string, receiptId: string, payload: Record<string, unknown> = {}): Promise<unknown> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_RECEIPT_REVERSAL(poId, receiptId), {
        method: 'POST',
        headers: buildPurchaseOrderIdempotentJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.receiptReversed') || '收货冲销已提交',
          type: 'success',
        });
        return json.data;
      }
      addToast({ message: json.error || '', type: 'error' });
      return null;
    } catch (e: unknown) {
      console.error('reverseReceipt failed:', e);
      const err = e as Error;
      addToast({ message: err.message, type: 'error' });
      return null;
    }
  };

  const closeShortages = async (poId: string, payload: CloseShortagesPayload): Promise<unknown> => {
    try {
      const res = await authFetch(API.MANAGE_PURCHASE_ORDER_SHORTAGE_CLOSURES(poId), {
        method: 'POST',
        headers: buildPurchaseOrderIdempotentJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json() as ApiResponse;

      if (json.success) {
        addToast({
          message: t('purchaseOrder.toast.shortageClosed') || '待收数量已关闭',
          type: 'success',
        });
        return json.data;
      }
      addToast({ message: json.error || '', type: 'error' });
      return null;
    } catch (e: unknown) {
      console.error('closeShortages failed:', e);
      const err = e as Error;
      addToast({ message: err.message, type: 'error' });
      return null;
    }
  };

  return {
    addItems,
    updateItem,
    removeItem,
    recordReceipts,
    reverseReceipt,
    closeShortages,
  };
}
