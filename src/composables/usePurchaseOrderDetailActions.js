import { computed, reactive, ref } from 'vue';
import {
  normalizeDecimal,
  normalizeNullableDecimal,
  normalizeReceiptQty,
} from '@/views/purchase-orders/drafts.js';

export function usePurchaseOrderDetailActions({
  detail,
  t,
  addToast,
  updatePO,
  allocateCosts,
  recordReceipts,
  reverseReceipt,
  closeShortages,
  refreshPurchaseOrderViews,
  receiptCandidates,
  shortageCandidates,
  canRecordReceipts,
  canCloseShortages,
}) {
  const showCostModal = ref(false);
  const costSubmitting = ref(false);
  const costDraft = reactive({
    remark: '',
    currency: 'CNY',
    allocation_method: 'by_quantity',
    estimated_shipping_cost: 0,
    estimated_tariff_cost: 0,
    actual_shipping_cost: '',
    actual_tariff_cost: '',
  });

  const showReceiptModal = ref(false);
  const receiptSubmitting = ref(false);
  const receiptDrafts = ref([]);

  const showShortageClosureModal = ref(false);
  const shortageSubmitting = ref(false);
  const shortageDrafts = ref([]);

  const showReceiptReversalModal = ref(false);
  const receiptReversalSubmitting = ref(false);
  const receiptReversalReason = ref('');
  const activeReceiptForReversal = ref(null);

  const canAllocateCurrentPurchaseOrder = computed(
    () =>
      detail.value?.status === 'completed'
      && Boolean(detail.value?.id)
      && (detail.value?.items?.length || 0) > 0
  );

  const resetCostModalState = () => {
    showCostModal.value = false;
    costDraft.remark = '';
    costDraft.currency = 'CNY';
    costDraft.allocation_method = 'by_quantity';
    costDraft.estimated_shipping_cost = 0;
    costDraft.estimated_tariff_cost = 0;
    costDraft.actual_shipping_cost = '';
    costDraft.actual_tariff_cost = '';
  };

  const openCostModal = () => {
    if (!detail.value) return;
    costDraft.remark = detail.value.remark || '';
    costDraft.currency = detail.value.currency || 'CNY';
    costDraft.allocation_method = detail.value.allocation_method || 'by_quantity';
    costDraft.estimated_shipping_cost = detail.value.estimated_shipping_cost ?? 0;
    costDraft.estimated_tariff_cost = detail.value.estimated_tariff_cost ?? 0;
    costDraft.actual_shipping_cost = detail.value.actual_shipping_cost ?? '';
    costDraft.actual_tariff_cost = detail.value.actual_tariff_cost ?? '';
    showCostModal.value = true;
  };

  const closeCostModal = () => {
    if (costSubmitting.value) return;
    resetCostModalState();
  };

  const saveCostSettings = async ({ allocateAfterSave = false } = {}) => {
    if (!detail.value || costSubmitting.value) return;

    costSubmitting.value = true;
    try {
      const saved = await updatePO(detail.value.id, {
        remark: String(costDraft.remark || '').trim() || null,
        currency:
          String(costDraft.currency || 'CNY')
            .trim()
            .toUpperCase() || 'CNY',
        allocation_method: costDraft.allocation_method || 'by_quantity',
        estimated_shipping_cost: normalizeDecimal(costDraft.estimated_shipping_cost, 0),
        estimated_tariff_cost: normalizeDecimal(costDraft.estimated_tariff_cost, 0),
        actual_shipping_cost: normalizeNullableDecimal(costDraft.actual_shipping_cost),
        actual_tariff_cost: normalizeNullableDecimal(costDraft.actual_tariff_cost),
      });
      if (!saved) return;

      if (allocateAfterSave && canAllocateCurrentPurchaseOrder.value) {
        const allocated = await allocateCosts(detail.value.id);
        if (!allocated) return;
      }

      resetCostModalState();
      await refreshPurchaseOrderViews(detail.value.id);
    } finally {
      costSubmitting.value = false;
    }
  };

  const resetReceiptModalState = () => {
    showReceiptModal.value = false;
    receiptDrafts.value = [];
  };

  const openReceiptModal = () => {
    if (!canRecordReceipts.value) return;
    receiptDrafts.value = receiptCandidates.value.map((entry) => ({ ...entry }));
    showReceiptModal.value = true;
  };

  const closeReceiptModal = () => {
    if (receiptSubmitting.value) return;
    resetReceiptModalState();
  };

  const resetShortageModalState = () => {
    showShortageClosureModal.value = false;
    shortageDrafts.value = [];
  };

  const openShortageModal = () => {
    if (!canCloseShortages.value) return;
    shortageDrafts.value = shortageCandidates.value.map((entry) => ({ ...entry }));
    showShortageClosureModal.value = true;
  };

  const closeShortageModal = () => {
    if (shortageSubmitting.value) return;
    resetShortageModalState();
  };

  const submitReceipts = async () => {
    if (!detail.value || receiptSubmitting.value) return;

    const items = receiptDrafts.value
      .map((entry) => ({
        purchase_order_item_id: entry.purchase_order_item_id,
        received_qty: normalizeReceiptQty(entry.received_qty),
        note: String(entry.note || '').trim() || undefined,
        max_receivable: Number(entry.max_receivable || 0),
      }))
      .filter((entry) => entry.received_qty > 0);

    if (items.length === 0) {
      addToast({
        type: 'warning',
        message: t('purchaseOrder.toast.receiptQtyRequired', '请至少填写一条收货数量'),
      });
      return;
    }

    if (items.some((entry) => entry.received_qty > entry.max_receivable)) {
      addToast({
        type: 'warning',
        message: t('purchaseOrder.ui.receiptQtyOverflow', '不能超过当前剩余可收数量。'),
      });
      return;
    }

    receiptSubmitting.value = true;
    try {
      const result = await recordReceipts(detail.value.id, {
        items: items.map(({ purchase_order_item_id, received_qty, note }) => ({
          purchase_order_item_id,
          received_qty,
          ...(note ? { note } : {}),
        })),
      });

      if (!result) return;

      resetReceiptModalState();
      await refreshPurchaseOrderViews(detail.value.id);
    } finally {
      receiptSubmitting.value = false;
    }
  };

  const submitShortageClosures = async () => {
    if (!detail.value || shortageSubmitting.value) return;

    const items = shortageDrafts.value
      .map((entry) => ({
        purchase_order_item_id: entry.purchase_order_item_id,
        close_qty: normalizeReceiptQty(entry.close_qty),
        max_closable: Number(entry.max_closable || 0),
      }))
      .filter((entry) => entry.close_qty > 0);

    if (items.length === 0) {
      addToast({
        type: 'warning',
        message: t('purchaseOrder.toast.shortageQtyRequired', '请至少填写一条关闭数量'),
      });
      return;
    }

    if (items.some((entry) => entry.close_qty > entry.max_closable)) {
      addToast({
        type: 'warning',
        message: t('purchaseOrder.ui.shortageQtyOverflow', '不能超过当前剩余待收数量。'),
      });
      return;
    }

    shortageSubmitting.value = true;
    try {
      const result = await closeShortages(detail.value.id, {
        items: items.map(({ purchase_order_item_id, close_qty }) => ({
          purchase_order_item_id,
          close_qty,
        })),
      });

      if (!result) return;

      resetShortageModalState();
      await refreshPurchaseOrderViews(detail.value.id);
    } finally {
      shortageSubmitting.value = false;
    }
  };

  const canReverseReceipt = (receipt = {}) =>
    ['ordered', 'shipping', 'arrived'].includes(String(detail.value?.status || ''))
    && normalizeReceiptQty(receipt.available_reversal_qty) > 0;

  const resetReceiptReversalState = () => {
    showReceiptReversalModal.value = false;
    activeReceiptForReversal.value = null;
    receiptReversalReason.value = '';
  };

  const openReceiptReversalModal = (receipt) => {
    if (!receipt || !canReverseReceipt(receipt)) return;
    activeReceiptForReversal.value = receipt;
    receiptReversalReason.value = '';
    showReceiptReversalModal.value = true;
  };

  const closeReceiptReversalModal = () => {
    if (receiptReversalSubmitting.value) return;
    resetReceiptReversalState();
  };

  const submitReceiptReversal = async () => {
    if (!detail.value || !activeReceiptForReversal.value || receiptReversalSubmitting.value) return;

    receiptReversalSubmitting.value = true;
    try {
      const result = await reverseReceipt(detail.value.id, activeReceiptForReversal.value.id, {
        reason: String(receiptReversalReason.value || '').trim() || undefined,
      });

      if (!result) return;

      resetReceiptReversalState();
      await refreshPurchaseOrderViews(detail.value.id);
    } finally {
      receiptReversalSubmitting.value = false;
    }
  };

  return {
    showCostModal,
    costSubmitting,
    costDraft,
    showReceiptModal,
    receiptSubmitting,
    receiptDrafts,
    showShortageClosureModal,
    shortageSubmitting,
    shortageDrafts,
    showReceiptReversalModal,
    receiptReversalSubmitting,
    receiptReversalReason,
    activeReceiptForReversal,
    canAllocateCurrentPurchaseOrder,
    resetCostModalState,
    openCostModal,
    closeCostModal,
    saveCostSettings,
    resetReceiptModalState,
    openReceiptModal,
    closeReceiptModal,
    resetShortageModalState,
    openShortageModal,
    closeShortageModal,
    submitReceipts,
    submitShortageClosures,
    canReverseReceipt,
    resetReceiptReversalState,
    openReceiptReversalModal,
    closeReceiptReversalModal,
    submitReceiptReversal,
  };
}
