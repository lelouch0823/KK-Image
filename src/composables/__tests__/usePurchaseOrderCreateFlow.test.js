import { reactive, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { usePurchaseOrderCreateFlow } from '../usePurchaseOrderCreateFlow.js';

const t = (_key, fallback) => fallback || '';

describe('usePurchaseOrderCreateFlow', () => {
  it('opens shortage confirm instead of creating immediately when draft has shortage items', async () => {
    const poItems = reactive([
      { product_id: 'product-1', variant_id: 'variant-1', quantity: 1, required_quantity: 3 },
    ]);
    const showShortageConfirm = ref(false);
    const createPO = vi.fn();

    const actions = usePurchaseOrderCreateFlow({
      t,
      addToast: vi.fn(),
      createForm: reactive({
        remark: '',
        currency: 'CNY',
        estimated_shipping_cost: 0,
        estimated_tariff_cost: 0,
        allocation_method: 'by_quantity',
      }),
      poItems,
      pickerTarget: ref('create'),
      detail: ref(null),
      detailRequestId: ref(''),
      showDetail: ref(false),
      showCreateModal: ref(true),
      showSuggestions: ref(false),
      showShortageConfirm,
      selectedSuggestions: ref([]),
      createPO,
      createFromOrders: vi.fn(),
      addItems: vi.fn(),
      removeItem: vi.fn(),
      refreshPurchaseOrderViews: vi.fn(),
      validateOrderQuantity: () => ({ valid: true }),
    });

    await actions.handleCreate();
    expect(showShortageConfirm.value).toBe(true);
    expect(createPO).not.toHaveBeenCalled();
  });

  it('warns when suggestions have no bindable order ids', async () => {
    const addToast = vi.fn();
    const createFromOrders = vi.fn();

    const actions = usePurchaseOrderCreateFlow({
      t,
      addToast,
      createForm: reactive({
        remark: '',
        currency: 'CNY',
        estimated_shipping_cost: 0,
        estimated_tariff_cost: 0,
        allocation_method: 'by_quantity',
      }),
      poItems: reactive([]),
      pickerTarget: ref('create'),
      detail: ref(null),
      detailRequestId: ref(''),
      showDetail: ref(false),
      showCreateModal: ref(false),
      showSuggestions: ref(true),
      showShortageConfirm: ref(false),
      selectedSuggestions: ref([]),
      createPO: vi.fn(),
      createFromOrders,
      addItems: vi.fn(),
      removeItem: vi.fn(),
      refreshPurchaseOrderViews: vi.fn(),
      validateOrderQuantity: () => ({ valid: true }),
    });

    await actions.handleCreateFromSuggestions();
    expect(addToast).toHaveBeenCalled();
    expect(createFromOrders).not.toHaveBeenCalled();
  });
});
