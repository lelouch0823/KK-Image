import { computed, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { usePurchaseOrderDetailActions } from '../usePurchaseOrderDetailActions.js';

const t = (_key, fallback) => fallback || '';

describe('usePurchaseOrderDetailActions', () => {
  it('seeds and resets cost draft from current detail', () => {
    const detail = ref({
      id: 'po-1',
      remark: 'memo',
      currency: 'USD',
      allocation_method: 'by_value',
      estimated_shipping_cost: 12,
      estimated_tariff_cost: 8,
      actual_shipping_cost: 20,
      actual_tariff_cost: 9,
      status: 'completed',
      items: [{ id: 'item-1' }],
    });

    const actions = usePurchaseOrderDetailActions({
      detail,
      t,
      addToast: vi.fn(),
      updatePO: vi.fn(),
      allocateCosts: vi.fn(),
      recordReceipts: vi.fn(),
      reverseReceipt: vi.fn(),
      closeShortages: vi.fn(),
      refreshPurchaseOrderViews: vi.fn(),
      receiptCandidates: computed(() => []),
      shortageCandidates: computed(() => []),
      canRecordReceipts: computed(() => false),
      canCloseShortages: computed(() => false),
    });

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
    const addToast = vi.fn();
    const recordReceipts = vi.fn();
    const actions = usePurchaseOrderDetailActions({
      detail: ref({ id: 'po-1', status: 'ordered' }),
      t,
      addToast,
      updatePO: vi.fn(),
      allocateCosts: vi.fn(),
      recordReceipts,
      reverseReceipt: vi.fn(),
      closeShortages: vi.fn(),
      refreshPurchaseOrderViews: vi.fn(),
      receiptCandidates: computed(() => [
        { purchase_order_item_id: 'item-1', received_qty: 0, max_receivable: 3 },
      ]),
      shortageCandidates: computed(() => []),
      canRecordReceipts: computed(() => true),
      canCloseShortages: computed(() => false),
    });

    actions.openReceiptModal();
    await actions.submitReceipts();

    expect(addToast).toHaveBeenCalled();
    expect(recordReceipts).not.toHaveBeenCalled();
  });

  it('seeds receipt, shortage, and reversal modal state from current detail payload', () => {
    const actions = usePurchaseOrderDetailActions({
      detail: ref({
        id: 'po-1',
        status: 'shipping',
      }),
      t,
      addToast: vi.fn(),
      updatePO: vi.fn(),
      allocateCosts: vi.fn(),
      recordReceipts: vi.fn(),
      reverseReceipt: vi.fn(),
      closeShortages: vi.fn(),
      refreshPurchaseOrderViews: vi.fn(),
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
});
