import { computed, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { usePurchaseOrderDetailActions } from '../usePurchaseOrderDetailActions.js';

const t = (_key, fallback) => fallback || '';

function createActions(overrides = {}) {
  const detail =
    overrides.detail ??
    ref({
      id: 'po-1',
      status: 'completed',
      items: [{ id: 'item-1' }],
      remark: 'memo',
      currency: 'USD',
      allocation_method: 'by_value',
      estimated_shipping_cost: 12,
      estimated_tariff_cost: 8,
      actual_shipping_cost: 20,
      actual_tariff_cost: 9,
    });
  const addToast = overrides.addToast ?? vi.fn();
  const updatePO = overrides.updatePO ?? vi.fn(async () => true);
  const allocateCosts = overrides.allocateCosts ?? vi.fn(async () => true);
  const recordReceipts = overrides.recordReceipts ?? vi.fn(async () => ({ ok: true }));
  const reverseReceipt = overrides.reverseReceipt ?? vi.fn(async () => ({ ok: true }));
  const closeShortages = overrides.closeShortages ?? vi.fn(async () => ({ ok: true }));
  const refreshPurchaseOrderViews = overrides.refreshPurchaseOrderViews ?? vi.fn(async () => true);
  const receiptCandidates = overrides.receiptCandidates ?? computed(() => []);
  const shortageCandidates = overrides.shortageCandidates ?? computed(() => []);
  const canRecordReceipts = overrides.canRecordReceipts ?? computed(() => false);
  const canCloseShortages = overrides.canCloseShortages ?? computed(() => false);

  return {
    detail,
    addToast,
    updatePO,
    allocateCosts,
    recordReceipts,
    reverseReceipt,
    closeShortages,
    refreshPurchaseOrderViews,
    actions: usePurchaseOrderDetailActions({
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
    }),
  };
}

describe('usePurchaseOrderDetailActions', () => {
  it('seeds and resets cost draft from current detail', () => {
    const { actions } = createActions();

    actions.openCostModal();
    expect(actions.showCostModal.value).toBe(true);
    expect(actions.costDraft.currency).toBe('USD');
    expect(actions.costDraft.actual_shipping_cost).toBe(20);

    actions.closeCostModal();
    expect(actions.showCostModal.value).toBe(false);
    expect(actions.costDraft.currency).toBe('CNY');
    expect(actions.costDraft.actual_shipping_cost).toBe('');
  });

  it('blocks empty receipt submission before calling api', async () => {
    const { actions, addToast, recordReceipts } = createActions({
      detail: ref({ id: 'po-1', status: 'ordered' }),
      receiptCandidates: computed(() => [
        { purchase_order_item_id: 'item-1', received_qty: 0, max_receivable: 3 },
      ]),
      canRecordReceipts: computed(() => true),
    });

    actions.openReceiptModal();
    await actions.submitReceipts();

    expect(addToast).toHaveBeenCalled();
    expect(recordReceipts).not.toHaveBeenCalled();
  });

  it('seeds receipt, shortage, and reversal modal state from current detail payload', () => {
    const { actions } = createActions({
      detail: ref({
        id: 'po-1',
        status: 'shipping',
      }),
      receiptCandidates: computed(() => [
        {
          purchase_order_item_id: 'item-1',
          product_name: 'Premium Canvas Bag',
          max_receivable: 3,
          received_qty: 0,
        },
      ]),
      shortageCandidates: computed(() => [
        {
          purchase_order_item_id: 'item-1',
          product_name: 'Premium Canvas Bag',
          max_closable: 2,
          close_qty: 0,
        },
      ]),
      canRecordReceipts: computed(() => true),
      canCloseShortages: computed(() => true),
    });

    actions.openReceiptModal();
    expect(actions.showReceiptModal.value).toBe(true);
    expect(actions.receiptDrafts.value).toHaveLength(1);
    expect(actions.receiptDrafts.value[0].received_qty).toBe(0);

    actions.openShortageModal();
    expect(actions.showShortageClosureModal.value).toBe(true);
    expect(actions.shortageDrafts.value).toHaveLength(1);
    expect(actions.shortageDrafts.value[0].close_qty).toBe(0);

    actions.openReceiptReversalModal({
      id: 'receipt-1',
      product_name: 'Premium Canvas Bag',
      received_qty: 3,
      available_reversal_qty: 3,
    });
    expect(actions.showReceiptReversalModal.value).toBe(true);
    expect(actions.activeReceiptForReversal.value?.id).toBe('receipt-1');
  });

  it('saves cost settings, allocates costs, and refreshes the current purchase order', async () => {
    const { actions, updatePO, allocateCosts, refreshPurchaseOrderViews } = createActions();

    actions.openCostModal();
    actions.costDraft.remark = '  final memo  ';
    actions.costDraft.currency = ' usd ';
    actions.costDraft.actual_shipping_cost = '';
    actions.costDraft.actual_tariff_cost = '18.5';

    await actions.saveCostSettings({ allocateAfterSave: true });

    expect(updatePO).toHaveBeenCalledWith('po-1', {
      remark: 'final memo',
      currency: 'USD',
      allocation_method: 'by_value',
      estimated_shipping_cost: 12,
      estimated_tariff_cost: 8,
      actual_shipping_cost: null,
      actual_tariff_cost: 18.5,
    });
    expect(allocateCosts).toHaveBeenCalledWith('po-1');
    expect(refreshPurchaseOrderViews).toHaveBeenCalledWith('po-1');
    expect(actions.showCostModal.value).toBe(false);
  });

  it('keeps the cost modal open when saving fails or allocation is blocked', async () => {
    const { actions, updatePO, allocateCosts } = createActions({
      updatePO: vi.fn(async () => false),
    });

    actions.openCostModal();
    await actions.saveCostSettings({ allocateAfterSave: true });

    expect(updatePO).toHaveBeenCalled();
    expect(allocateCosts).not.toHaveBeenCalled();
    expect(actions.showCostModal.value).toBe(true);
  });

  it('submits valid receipts, trims notes, and resets the modal state', async () => {
    const { actions, recordReceipts, refreshPurchaseOrderViews } = createActions({
      detail: ref({ id: 'po-1', status: 'ordered' }),
      receiptCandidates: computed(() => [
        {
          purchase_order_item_id: 'item-1',
          received_qty: '2',
          note: '  received  ',
          max_receivable: 3,
        },
        {
          purchase_order_item_id: 'item-2',
          received_qty: '0',
          note: 'skip',
          max_receivable: 3,
        },
      ]),
      canRecordReceipts: computed(() => true),
    });

    actions.openReceiptModal();
    await actions.submitReceipts();

    expect(recordReceipts).toHaveBeenCalledWith('po-1', {
      items: [{ purchase_order_item_id: 'item-1', received_qty: 2, note: 'received' }],
    });
    expect(refreshPurchaseOrderViews).toHaveBeenCalledWith('po-1');
    expect(actions.showReceiptModal.value).toBe(false);
    expect(actions.receiptDrafts.value).toEqual([]);
  });

  it('blocks overflowing receipt quantities before submitting', async () => {
    const { actions, addToast, recordReceipts } = createActions({
      detail: ref({ id: 'po-1', status: 'ordered' }),
      receiptCandidates: computed(() => [
        { purchase_order_item_id: 'item-1', received_qty: 5, max_receivable: 3 },
      ]),
      canRecordReceipts: computed(() => true),
    });

    actions.openReceiptModal();
    await actions.submitReceipts();

    expect(recordReceipts).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith({
      type: 'warning',
      message: '不能超过当前剩余可收数量。',
    });
  });

  it('submits shortage closures and preserves modal state when blocked by overflow', async () => {
    const success = createActions({
      detail: ref({ id: 'po-1', status: 'ordered' }),
      shortageCandidates: computed(() => [
        { purchase_order_item_id: 'item-1', close_qty: '2', max_closable: 3 },
      ]),
      canCloseShortages: computed(() => true),
    });

    success.actions.openShortageModal();
    await success.actions.submitShortageClosures();

    expect(success.closeShortages).toHaveBeenCalledWith('po-1', {
      items: [{ purchase_order_item_id: 'item-1', close_qty: 2 }],
    });
    expect(success.refreshPurchaseOrderViews).toHaveBeenCalledWith('po-1');
    expect(success.actions.showShortageClosureModal.value).toBe(false);

    const blocked = createActions({
      detail: ref({ id: 'po-1', status: 'ordered' }),
      shortageCandidates: computed(() => [
        { purchase_order_item_id: 'item-1', close_qty: '4', max_closable: 3 },
      ]),
      canCloseShortages: computed(() => true),
    });

    blocked.actions.openShortageModal();
    await blocked.actions.submitShortageClosures();

    expect(blocked.closeShortages).not.toHaveBeenCalled();
    expect(blocked.addToast).toHaveBeenCalledWith({
      type: 'warning',
      message: '不能超过当前剩余待收数量。',
    });
    expect(blocked.actions.showShortageClosureModal.value).toBe(true);
  });

  it('submits receipt reversals only for reversible receipts and refreshes afterward', async () => {
    const { actions, reverseReceipt, refreshPurchaseOrderViews } = createActions({
      detail: ref({ id: 'po-1', status: 'shipping' }),
    });

    actions.openReceiptReversalModal({ id: 'receipt-0', available_reversal_qty: 0 });
    expect(actions.showReceiptReversalModal.value).toBe(false);

    actions.openReceiptReversalModal({ id: 'receipt-1', available_reversal_qty: 3 });
    actions.receiptReversalReason.value = '  rollback  ';
    await actions.submitReceiptReversal();

    expect(reverseReceipt).toHaveBeenCalledWith('po-1', 'receipt-1', { reason: 'rollback' });
    expect(refreshPurchaseOrderViews).toHaveBeenCalledWith('po-1');
    expect(actions.showReceiptReversalModal.value).toBe(false);
    expect(actions.activeReceiptForReversal.value).toBeNull();
  });
});
