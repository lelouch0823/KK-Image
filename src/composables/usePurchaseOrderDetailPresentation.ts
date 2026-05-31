import { computed, type ComputedRef } from 'vue';
import {
  getPurchaseOrderCancelledQty,
  getPurchaseOrderOrderedQty,
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from '@/utils/purchase-order-progress';

interface DetailItem {
  id: string;
  product_name?: string;
  variant_sku?: string;
  product_sku?: string;
  customer_order_no?: string;
  variant_options?: Record<string, unknown>;
  [key: string]: unknown;
}

interface DetailData {
  id?: string;
  status?: string;
  display_status?: string;
  ordered_qty?: number;
  item_count?: number;
  received_qty?: number;
  outstanding_qty?: number;
  total_goods_cost?: number;
  currency?: string;
  items?: DetailItem[];
  receipts?: unknown[];
  [key: string]: unknown;
}

interface SummaryCard {
  key: string;
  label: string;
  value: string;
  hint: string;
}

interface ReceiptCandidate {
  purchase_order_item_id: string;
  product_name: string;
  variant_sku: string;
  ordered_qty: number;
  received_qty_before: number;
  max_receivable: number;
  customer_order_no: string;
  variant_options: Record<string, unknown>;
  note: string;
  received_qty: number;
}

interface ShortageCandidate {
  purchase_order_item_id: string;
  product_name: string;
  variant_sku: string;
  ordered_qty: number;
  received_qty_before: number;
  cancelled_qty_before: number;
  max_closable: number;
  customer_order_no: string;
  variant_options: Record<string, unknown>;
  close_qty: number;
}

interface ProgressStatusMeta {
  label: string;
  variant: string;
}

interface UsePurchaseOrderDetailPresentationOptions {
  detail: ComputedRef<DetailData | null>;
  t: (key: string, fallback?: string) => string;
  formatInteger: (value: number | undefined) => string;
  formatPurchaseCurrency: (value: number | undefined, currency?: string) => string;
  buildReceiptProgressSummary: (data: DetailData) => string;
  buildReceiptMeta: (data: DetailData) => string;
}

export function usePurchaseOrderDetailPresentation({
  detail,
  t,
  formatInteger,
  formatPurchaseCurrency,
  buildReceiptProgressSummary,
  buildReceiptMeta,
}: UsePurchaseOrderDetailPresentationOptions) {
  const progressStatusConfig: ComputedRef<Record<string, ProgressStatusMeta>> = computed(() => ({
    open: { label: t('purchaseOrder.progress.open', '待到货'), variant: 'warning' },
    partially_received: {
      label: t('purchaseOrder.progress.partiallyReceived', '部分到货'),
      variant: 'primary',
    },
    received: { label: t('purchaseOrder.progress.received', '已全部到货'), variant: 'success' },
    cancelled: { label: t('purchaseOrder.progress.cancelled', '已取消'), variant: 'default' },
  }));

  const getProgressStatusMeta = (status: string): ProgressStatusMeta =>
    progressStatusConfig.value[status] || progressStatusConfig.value.open;

  const getProgressStatusLabel = (status: string): string => getProgressStatusMeta(status).label;

  const getProgressStatusVariant = (status: string): string => getProgressStatusMeta(status).variant;

  const detailSummaryCards: ComputedRef<SummaryCard[]> = computed(() => {
    if (!detail.value) return [];

    return [
      {
        key: 'ordered',
        label: t('purchaseOrder.ui.orderedVolume', '采购数量'),
        value: formatInteger(detail.value.ordered_qty),
        hint: `${formatInteger(detail.value.item_count)} ${t('purchaseOrder.ui.lineCount', '条明细')}`,
      },
      {
        key: 'received',
        label: t('purchaseOrder.ui.receivedVolume', '已到货'),
        value: formatInteger(detail.value.received_qty),
        hint: getProgressStatusLabel(detail.value.display_status || 'open'),
      },
      {
        key: 'outstanding',
        label: t('purchaseOrder.ui.outstandingVolume', '待收货'),
        value: formatInteger(detail.value.outstanding_qty),
        hint: buildReceiptProgressSummary(detail.value),
      },
      {
        key: 'goods',
        label: t('purchaseOrder.ui.goodsTotal', '商品总额'),
        value: formatPurchaseCurrency(detail.value.total_goods_cost, detail.value.currency),
        hint:
          buildReceiptMeta(detail.value) ||
          t('purchaseOrder.ui.awaitingReceiptMeta', '尚未产生入库记录'),
      },
    ];
  });

  const receiptTimeline: ComputedRef<unknown[]> = computed(() =>
    Array.isArray(detail.value?.receipts) ? detail.value.receipts : []
  );

  const receiptCandidates: ComputedRef<ReceiptCandidate[]> = computed(() => {
    if (!detail.value || !Array.isArray(detail.value.items)) return [];

    return detail.value.items
      .map((item) => ({
        purchase_order_item_id: item.id,
        product_name: item.product_name || '—',
        variant_sku: item.variant_sku || item.product_sku || '—',
        ordered_qty: getPurchaseOrderOrderedQty(item),
        received_qty_before: getPurchaseOrderReceivedQty(item),
        max_receivable: getPurchaseOrderOutstandingQty(item),
        customer_order_no: item.customer_order_no || '',
        variant_options: item.variant_options || {},
        note: '',
        received_qty: 0,
      }))
      .filter((item) => item.max_receivable > 0);
  });

  const receiptReceivableCount: ComputedRef<number> = computed(() => receiptCandidates.value.length);

  const canRecordReceipts: ComputedRef<boolean> = computed(
    () =>
      Boolean(detail.value?.id) &&
      ['ordered', 'shipping'].includes(String(detail.value?.status || '')) &&
      receiptCandidates.value.length > 0
  );

  const shortageCandidates: ComputedRef<ShortageCandidate[]> = computed(() => {
    if (!detail.value || !Array.isArray(detail.value.items)) return [];

    return detail.value.items
      .map((item) => ({
        purchase_order_item_id: item.id,
        product_name: item.product_name || '—',
        variant_sku: item.variant_sku || item.product_sku || '—',
        ordered_qty: getPurchaseOrderOrderedQty(item),
        received_qty_before: getPurchaseOrderReceivedQty(item),
        cancelled_qty_before: getPurchaseOrderCancelledQty(item),
        max_closable: getPurchaseOrderOutstandingQty(item),
        customer_order_no: item.customer_order_no || '',
        variant_options: item.variant_options || {},
        close_qty: 0,
      }))
      .filter((item) => item.max_closable > 0);
  });

  const canCloseShortages: ComputedRef<boolean> = computed(
    () =>
      Boolean(detail.value?.id) &&
      ['ordered', 'shipping'].includes(String(detail.value?.status || '')) &&
      shortageCandidates.value.length > 0
  );

  return {
    detailSummaryCards,
    receiptTimeline,
    receiptCandidates,
    receiptReceivableCount,
    canRecordReceipts,
    shortageCandidates,
    canCloseShortages,
    getProgressStatusLabel,
    getProgressStatusVariant,
  };
}
