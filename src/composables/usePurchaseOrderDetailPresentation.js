import { computed } from 'vue';
import {
  getPurchaseOrderCancelledQty,
  getPurchaseOrderOrderedQty,
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from '@/utils/purchase-order-progress';

export function usePurchaseOrderDetailPresentation({
  detail,
  t,
  formatInteger,
  formatPurchaseCurrency,
  buildReceiptProgressSummary,
  buildReceiptMeta,
}) {
  const progressStatusConfig = computed(() => ({
    open: { label: t('purchaseOrder.progress.open', '待到货'), variant: 'warning' },
    partially_received: {
      label: t('purchaseOrder.progress.partiallyReceived', '部分到货'),
      variant: 'primary',
    },
    received: { label: t('purchaseOrder.progress.received', '已全部到货'), variant: 'success' },
    cancelled: { label: t('purchaseOrder.progress.cancelled', '已取消'), variant: 'default' },
  }));

  const getProgressStatusMeta = (status) =>
    progressStatusConfig.value[status] || progressStatusConfig.value.open;

  const getProgressStatusLabel = (status) => getProgressStatusMeta(status).label;

  const getProgressStatusVariant = (status) => getProgressStatusMeta(status).variant;

  const detailSummaryCards = computed(() => {
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
        hint: getProgressStatusLabel(detail.value.display_status),
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

  const receiptTimeline = computed(() =>
    Array.isArray(detail.value?.receipts) ? detail.value.receipts : []
  );

  const receiptCandidates = computed(() => {
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

  const receiptReceivableCount = computed(() => receiptCandidates.value.length);

  const canRecordReceipts = computed(
    () =>
      Boolean(detail.value?.id) &&
      ['ordered', 'shipping'].includes(String(detail.value?.status || '')) &&
      receiptCandidates.value.length > 0
  );

  const shortageCandidates = computed(() => {
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

  const canCloseShortages = computed(
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
