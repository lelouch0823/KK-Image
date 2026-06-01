/**
 * 付款记录 Composable
 * ====================
 *
 * 处理订单付款记录的 CRUD 操作
 *
 * @module composables/usePayments
 */

import { ref, type Ref } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import { useAuth } from '@/composables/useAuth';

/** 付款记录接口 */
export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  referenceNo: string | null;
  notes: string | null;
  receivedAt: number;
  createdBy: string | null;
}

/** 付款汇总接口 */
export interface PaymentSummary {
  orderAmount: number;
  totalPaid: number;
  outstanding: number;
}

/** 付款数据接口 */
export interface PaymentData {
  payments: Payment[];
  summary: PaymentSummary;
}

export function usePayments(orderId: Ref<string | null>) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const { authFetch } = useAuth();

  const payments = ref<Payment[]>([]);
  const summary = ref<PaymentSummary>({
    orderAmount: 0,
    totalPaid: 0,
    outstanding: 0,
  });
  const loading = ref(false);
  const adding = ref(false);

  /**
   * 加载付款记录
   */
  async function loadPayments(): Promise<void> {
    if (!orderId.value) return;

    loading.value = true;
    try {
      const res = await authFetch(API.MANAGE_ORDER_PAYMENTS(orderId.value));
      const data = await res.json();

      if (data.success) {
        payments.value = data.data.payments;
        summary.value = data.data.summary;
      }
    } catch {
      // 静默失败，不影响订单详情展示
    } finally {
      loading.value = false;
    }
  }

  /**
   * 添加付款记录
   */
  async function addPayment(params: {
    amount: number;
    method: string;
    referenceNo?: string;
    notes?: string;
  }): Promise<boolean> {
    if (!orderId.value) return false;

    adding.value = true;
    try {
      const res = await authFetch(API.MANAGE_ORDER_PAYMENTS(orderId.value), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();

      if (data.success) {
        addToast({ message: t('order.payment.addSuccess'), type: 'success' });
        await loadPayments();
        return true;
      } else {
        addToast({ message: data.error || t('common.operationFailed'), type: 'error' });
        return false;
      }
    } catch {
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    } finally {
      adding.value = false;
    }
  }

  /**
   * 删除付款记录
   */
  async function deletePayment(paymentId: string): Promise<boolean> {
    if (!orderId.value) return false;

    try {
      const res = await authFetch(
        API.MANAGE_ORDER_PAYMENT_DELETE(orderId.value, paymentId),
        { method: 'DELETE' }
      );
      const data = await res.json();

      if (data.success) {
        addToast({ message: t('order.payment.deleteSuccess'), type: 'success' });
        await loadPayments();
        return true;
      } else {
        addToast({ message: data.error || t('common.operationFailed'), type: 'error' });
        return false;
      }
    } catch {
      addToast({ message: t('common.networkError'), type: 'error' });
      return false;
    }
  }

  return {
    payments,
    summary,
    loading,
    adding,
    loadPayments,
    addPayment,
    deletePayment,
  };
}
