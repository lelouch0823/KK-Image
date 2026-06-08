import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, reactive, computed } from 'vue';
import PurchaseOrders from '../PurchaseOrders.vue';

const mocks = vi.hoisted(() => ({
  routeQuery: {},
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  loadList: vi.fn(),
  loadStats: vi.fn(),
  loadDetail: vi.fn(),
  loadPurchaseOrderOverview: vi.fn(),
  refreshPurchaseOrderViews: vi.fn(),
  loadSuggestions: vi.fn(),
  reverseReceipt: vi.fn(),
  createPO: vi.fn(),
  addItems: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  addToast: vi.fn(),
  createFromOrders: vi.fn(),
  refreshBusCallback: null,
  subscribeModule: vi.fn(),
  modalState: {
    showDetail: true,
    showCreateModal: false,
    showSuggestions: false,
    showOrderPicker: false,
    showProductPicker: false,
    pickerTarget: 'create',
    showShortageConfirm: false,
  },
  listState: {
    items: [],
    total: 0,
    loading: false,
    stats: null,
  },
  detailState: {
    detail: null,
    detailLoading: true,
  },
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

vi.mock('@/composables/usePurchaseOrders', () => ({
  usePurchaseOrders: () => ({
    list: computed(() => mocks.listState.items),
    total: computed(() => mocks.listState.total),
    loading: computed(() => mocks.listState.loading),
    error: ref(''),
    errorCode: ref(''),
    detail: computed(() => mocks.detailState.detail),
    detailLoading: computed(() => mocks.detailState.detailLoading),
    suggestions: ref([]),
    suggestionsLoading: ref(false),
    stats: computed(() => mocks.listState.stats),
    filters: reactive({ status: '', page: 1, limit: 20 }),
    statusConfig: computed(() => ({})),
    loadList: mocks.loadList,
    loadStats: mocks.loadStats,
    loadDetail: mocks.loadDetail,
    loadPurchaseOrderOverview: mocks.loadPurchaseOrderOverview,
    refreshPurchaseOrderViews: mocks.refreshPurchaseOrderViews,
    createPO: mocks.createPO,
    createFromOrders: mocks.createFromOrders,
    updatePO: vi.fn(),
    updateStatus: vi.fn(),
    loadSuggestions: mocks.loadSuggestions,
    addItems: mocks.addItems,
    removeItem: mocks.removeItem,
    updateItem: mocks.updateItem,
    recordReceipts: vi.fn(),
    reverseReceipt: mocks.reverseReceipt,
    closeShortages: vi.fn(),
    allocateCosts: vi.fn(),
  }),
}));

vi.mock('@/composables/usePurchaseOrderModals', () => ({
  usePurchaseOrderModals: () => ({
    showDetail: ref(mocks.modalState.showDetail),
    showCreateModal: ref(mocks.modalState.showCreateModal),
    showSuggestions: ref(mocks.modalState.showSuggestions),
    showOrderPicker: ref(mocks.modalState.showOrderPicker),
    showProductPicker: ref(mocks.modalState.showProductPicker),
    pickerTarget: ref(mocks.modalState.pickerTarget),
    showShortageConfirm: ref(mocks.modalState.showShortageConfirm),
    confirmData: reactive({
      show: false,
      title: '',
      message: '',
      type: 'primary',
      loading: false,
      onConfirm: vi.fn(),
    }),
    viewProductId: ref(null),
    detailFocusedVariantId: vi.fn(() => null),
    openOrderPicker: vi.fn(),
    openProductPicker: vi.fn(),
    closeDetail: vi.fn(),
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useAI', () => ({
  useAI: () => ({ setContext: vi.fn() }),
}));

vi.mock('@/composables/useAppRefreshBus', () => ({
  useAppRefreshBus: () => ({ subscribeModule: mocks.subscribeModule }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/purchase-orders', query: mocks.routeQuery }),
  useRouter: () => ({ replace: mocks.routerReplace, push: mocks.routerPush }),
}));

const appSelectStub = {
  props: ['modelValue', 'options', 'placeholder', 'size'],
  template: `
    <select>
      <option
        v-for="option in options || []"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  `,
};

function mountPurchaseOrdersShell() {
  return mount(PurchaseOrders, {
    global: {
      stubs: {
        Teleport: true,
        Transition: false,
        OrderPickerModal: { template: '<div />' },
        ProductPickerModal: { template: '<div />' },
        ProductDetailModal: { template: '<div />' },
        AppImage: { template: '<div />' },
        AppIcon: { template: '<i />' },
        AppFilterBar: { template: '<div />' },
        AppButton: { template: '<button><slot /></button>' },
        AppInput: {
          template: '<div />',
          props: ['modelValue', 'type', 'min', 'step', 'size', 'placeholder', 'disabled'],
        },
        AppCheckbox: { template: '<input type="checkbox" />' },
        AppSelect: appSelectStub,
        AppTable: { template: '<div />' },
        StatusBadge: { template: '<div><slot /></div>' },
        PermissionDeniedState: { template: '<div />' },
        MetricTile: { template: '<div />' },
        ManagementListShell: {
          template: '<div><slot name="actions" /><slot name="content" /></div>',
        },
      },
    },
  });
}

describe('PurchaseOrders detail shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.routeQuery = {};
    mocks.listState.items = [];
    mocks.listState.total = 0;
    mocks.listState.loading = false;
    mocks.listState.stats = null;
    mocks.detailState.detail = null;
    mocks.detailState.detailLoading = true;
    mocks.modalState.showDetail = true;
    mocks.modalState.showCreateModal = false;
    mocks.modalState.showSuggestions = false;
    mocks.modalState.showOrderPicker = false;
    mocks.modalState.showProductPicker = false;
    mocks.modalState.pickerTarget = 'create';
    mocks.modalState.showShortageConfirm = false;
    mocks.refreshBusCallback = null;
    mocks.subscribeModule.mockImplementation((_module, callback) => {
      mocks.refreshBusCallback = callback;
      return vi.fn();
    });
    mocks.loadList.mockResolvedValue();
    mocks.loadStats.mockResolvedValue();
    mocks.loadDetail.mockResolvedValue();
    mocks.loadPurchaseOrderOverview.mockResolvedValue({
      listLoaded: true,
      statsLoaded: true,
    });
    mocks.refreshPurchaseOrderViews.mockResolvedValue({
      detailLoaded: true,
      listLoaded: true,
      statsLoaded: true,
    });
    mocks.loadSuggestions.mockResolvedValue();
    mocks.reverseReceipt.mockResolvedValue({ reversal_id: 'reversal-1' });
    mocks.createPO.mockResolvedValue({ id: 'po-created' });
    mocks.addItems.mockResolvedValue(true);
    mocks.updateItem.mockResolvedValue(true);
    mocks.removeItem.mockResolvedValue(true);
    mocks.createFromOrders.mockResolvedValue({ id: 'po-from-suggestions' });
  });

  it('renders detail shell while purchase-order detail is still loading', () => {
    const wrapper = mount(PurchaseOrders, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          OrderPickerModal: { template: '<div />' },
          ProductPickerModal: { template: '<div />' },
          ProductDetailModal: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppIcon: { template: '<i />' },
          AppFilterBar: { template: '<div />' },
          AppButton: { template: '<button><slot /></button>' },
          AppTable: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
        },
      },
    });

    expect(wrapper.find('[data-testid="purchase-order-detail-shell"]').exists()).toBe(true);
  });

  it('preserves query-driven intent until user dismisses the detail shell', async () => {
    mocks.routeQuery = { id: 'po-1' };

    mount(PurchaseOrders, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          OrderPickerModal: { template: '<div />' },
          ProductPickerModal: { template: '<div />' },
          ProductDetailModal: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppIcon: { template: '<i />' },
          AppFilterBar: { template: '<div />' },
          AppButton: { template: '<button><slot /></button>' },
          AppTable: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
        },
      },
    });

    expect(mocks.routerReplace).not.toHaveBeenCalled();
  });

  it('shows retry action when purchase-order detail failed to load', async () => {
    mocks.detailState.detailLoading = false;

    const wrapper = mount(PurchaseOrders, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          OrderPickerModal: { template: '<div />' },
          ProductPickerModal: { template: '<div />' },
          ProductDetailModal: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppIcon: { template: '<i />' },
          AppFilterBar: { template: '<div />' },
          AppButton: { template: '<button><slot /></button>' },
          AppTable: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
        },
      },
    });

    expect(wrapper.find('[data-testid="purchase-order-detail-retry"]').exists()).toBe(true);
  });

  it('reloads purchase-order overview through the shared helper when the refresh bus fires without an open modal', async () => {
    mocks.modalState.showDetail = false;
    mocks.modalState.showCreateModal = false;

    mountPurchaseOrdersShell();

    await mocks.refreshBusCallback?.();

    expect(mocks.loadPurchaseOrderOverview).toHaveBeenCalledTimes(1);
  });

  it('keeps summary, progress, cost, and items regions visible once detail loads', () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'ordered',
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 120,
      estimated_tariff_cost: 60,
      actual_shipping_cost: null,
      actual_tariff_cost: null,
      items: [
        {
          id: 'item-1',
          product_id: 'prod-1',
          product_name: 'Premium Canvas Bag',
          product_brand: 'KK',
          product_sku: 'KK-BAG-01',
          product_images: [],
          quantity: 12,
          unit_cost: 25.5,
          product_specifications: { Color: 'Black' },
        },
      ],
    };

    const wrapper = mount(PurchaseOrders, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          OrderPickerModal: { template: '<div />' },
          ProductPickerModal: { template: '<div />' },
          ProductDetailModal: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppIcon: { template: '<i />' },
          AppFilterBar: { template: '<div />' },
          AppButton: { template: '<button><slot /></button>' },
          AppInput: {
            template: '<div />',
            props: ['modelValue', 'type', 'min', 'step', 'size', 'placeholder', 'disabled'],
          },
          AppCheckbox: { template: '<input type="checkbox" />' },
          AppSelect: appSelectStub,
          AppTable: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          MetricTile: { template: '<div />' },
          ManagementListShell: {
            template: '<div><slot name="actions" /><slot name="content" /></div>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="purchase-order-detail-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-status-chip"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-progress"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-cost"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-items"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-receipts"]').exists()).toBe(true);
  });

  it('renders receipt progress and variant options for loaded purchase-order items', () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'ordered',
      display_status: 'partially_received',
      ordered_qty: 12,
      received_qty: 4,
      cancelled_qty: 1,
      outstanding_qty: 7,
      receipt_count: 2,
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 120,
      estimated_tariff_cost: 60,
      items: [
        {
          id: 'item-1',
          product_id: 'prod-1',
          product_name: 'Premium Canvas Bag',
          product_brand: 'KK',
          product_sku: 'KK-BAG-01',
          product_images: [],
          quantity: 12,
          unit_cost: 25.5,
          received_qty: 4,
          cancelled_qty: 1,
          receipt_count: 2,
          last_received_at: Date.UTC(2026, 2, 29),
          variant_options: { Color: 'Black', Size: 'Large' },
          product_specifications: { Material: 'Canvas' },
        },
      ],
    };

    const wrapper = mount(PurchaseOrders, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          OrderPickerModal: { template: '<div />' },
          ProductPickerModal: { template: '<div />' },
          ProductDetailModal: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppIcon: { template: '<i />' },
          AppFilterBar: { template: '<div />' },
          AppButton: { template: '<button><slot /></button>' },
          AppInput: {
            template: '<div />',
            props: ['modelValue', 'type', 'min', 'step', 'size', 'placeholder', 'disabled'],
          },
          AppCheckbox: { template: '<input type="checkbox" />' },
          AppSelect: appSelectStub,
          AppTable: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          MetricTile: { template: '<div />' },
          ManagementListShell: {
            template: '<div><slot name="actions" /><slot name="content" /></div>',
          },
        },
      },
    });

    expect(wrapper.get('[data-testid="purchase-order-detail-progress-badge"]').text()).toContain(
      '部分到货'
    );
    expect(wrapper.get('[data-testid="purchase-order-detail-progress-summary"]').text()).toContain(
      '4 / 12'
    );
    expect(wrapper.get('[data-testid="purchase-order-detail-progress-summary"]').text()).toContain(
      '待收 7'
    );
    expect(wrapper.get('[data-testid="purchase-order-detail-item-progress"]').text()).toContain(
      '已到 4 / 12'
    );
    expect(wrapper.get('[data-testid="purchase-order-detail-item-progress"]').text()).toContain(
      '取消 1'
    );
    expect(wrapper.get('[data-testid="purchase-order-detail-item-progress"]').text()).toContain(
      '2 次入库'
    );
    expect(wrapper.get('[data-testid="purchase-order-detail-item-progress"]').text()).toContain(
      '最近到货'
    );
    expect(
      wrapper.get('[data-testid="purchase-order-detail-item-variant-options"]').text()
    ).toContain('Color: Black');
    expect(
      wrapper.get('[data-testid="purchase-order-detail-item-variant-options"]').text()
    ).toContain('Size: Large');
  });

  it('renders receipt ledger history and reversal affordance from purchase-order detail payload', () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'shipping',
      display_status: 'partially_received',
      ordered_qty: 12,
      received_qty: 4,
      cancelled_qty: 0,
      outstanding_qty: 8,
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 120,
      estimated_tariff_cost: 60,
      items: [
        {
          id: 'item-1',
          product_id: 'prod-1',
          product_name: 'Premium Canvas Bag',
          product_brand: 'KK',
          product_sku: 'KK-BAG-01',
          product_images: [],
          quantity: 12,
          unit_cost: 25.5,
          received_qty: 4,
          cancelled_qty: 0,
          variant_options: { Color: 'Black' },
          product_specifications: { Material: 'Canvas' },
        },
      ],
      receipts: [
        {
          id: 'receipt-1',
          product_name: 'Premium Canvas Bag',
          product_sku: 'KK-BAG-01',
          variant_sku: 'KK-BAG-01-BLK',
          received_qty: 4,
          available_reversal_qty: 4,
          reversed_qty: 0,
          reversal_count: 0,
          received_at: Date.UTC(2026, 2, 29, 8, 30),
          note: 'first truck arrived',
          variant_options: { Color: 'Black' },
        },
      ],
    };

    const wrapper = mount(PurchaseOrders, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          OrderPickerModal: { template: '<div />' },
          ProductPickerModal: { template: '<div />' },
          ProductDetailModal: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppIcon: { template: '<i />' },
          AppFilterBar: { template: '<div />' },
          AppButton: { template: '<button><slot /></button>' },
          AppInput: {
            template: '<div />',
            props: ['modelValue', 'type', 'min', 'step', 'size', 'placeholder', 'disabled'],
          },
          AppCheckbox: { template: '<input type="checkbox" />' },
          AppSelect: appSelectStub,
          AppTable: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          MetricTile: { template: '<div />' },
          ManagementListShell: {
            template: '<div><slot name="actions" /><slot name="content" /></div>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="purchase-order-detail-receipts"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="purchase-order-receipt-card"]').text()).toContain(
      'Premium Canvas Bag'
    );
    expect(wrapper.get('[data-testid="purchase-order-receipt-card"]').text()).toContain('4');
    expect(wrapper.get('[data-testid="purchase-order-receipt-card"]').text()).toContain(
      'first truck arrived'
    );
    expect(wrapper.find('[data-testid="purchase-order-open-reversal-modal"]').exists()).toBe(true);
  });

  it('renders aggregated receipt progress in the purchase-order list status cell', () => {
    mocks.listState.items = [
      {
        id: 'po-1',
        po_no: 'PO-20260312-001',
        status: 'ordered',
        display_status: 'partially_received',
        ordered_qty: 10,
        received_qty: 4,
        cancelled_qty: 1,
        outstanding_qty: 5,
        item_count: 2,
        total_goods_cost: 255,
        remark: '',
        created_at: Date.UTC(2026, 2, 28),
      },
    ];
    mocks.listState.total = 1;

    const wrapper = mount(PurchaseOrders, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          OrderPickerModal: { template: '<div />' },
          ProductPickerModal: { template: '<div />' },
          ProductDetailModal: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppIcon: { template: '<i />' },
          AppFilterBar: { template: '<div />' },
          AppButton: { template: '<button><slot /></button>' },
          AppInput: {
            template: '<div />',
            props: ['modelValue', 'type', 'min', 'step', 'size', 'placeholder', 'disabled'],
          },
          AppCheckbox: { template: '<input type="checkbox" />' },
          AppSelect: appSelectStub,
          AppTable: {
            props: ['columns', 'data'],
            template: `
              <div>
                <slot name="toolbar" />
                <div v-for="row in data" :key="row.id">
                  <div v-for="column in columns" :key="column.key">
                    <slot :name="'cell-' + column.key" :row="row">{{ row[column.key] }}</slot>
                  </div>
                </div>
              </div>
            `,
          },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          MetricTile: { template: '<div />' },
          ManagementListShell: {
            template: '<div><slot name="actions" /><slot name="content" /></div>',
          },
        },
      },
    });

    expect(wrapper.get('[data-testid="purchase-order-progress-badge"]').text()).toContain(
      '部分到货'
    );
    expect(wrapper.get('[data-testid="purchase-order-progress-summary"]').text()).toContain(
      '4 / 10'
    );
    expect(wrapper.get('[data-testid="purchase-order-progress-summary"]').text()).toContain(
      '待收 5'
    );
  });

  it('does not offer arrived transition while outstanding quantity remains', () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'shipping',
      outstanding_qty: 5,
      ordered_qty: 10,
      received_qty: 4,
      cancelled_qty: 1,
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 0,
      estimated_tariff_cost: 0,
      items: [],
      receipts: [],
    };

    const wrapper = mountPurchaseOrdersShell();

    expect(wrapper.get('[data-testid="purchase-order-detail-footer"]').text()).not.toContain(
      'arrived'
    );
  });

  it('offers arrived transition once outstanding quantity is zero', () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'shipping',
      outstanding_qty: 0,
      ordered_qty: 10,
      received_qty: 8,
      cancelled_qty: 2,
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 0,
      estimated_tariff_cost: 0,
      items: [],
      receipts: [],
    };

    const wrapper = mountPurchaseOrdersShell();

    expect(wrapper.get('[data-testid="purchase-order-detail-footer"]').text()).toContain('arrived');
  });

  it('shows shortage-closure entry when ordered or shipping purchase orders still have receivable lines', () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'shipping',
      outstanding_qty: 2,
      ordered_qty: 10,
      received_qty: 8,
      cancelled_qty: 0,
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 0,
      estimated_tariff_cost: 0,
      items: [
        {
          id: 'item-1',
          quantity: 10,
          received_qty: 8,
          cancelled_qty: 0,
          product_name: 'Premium Canvas Bag',
          product_specifications: {},
          variant_options: {},
        },
      ],
      receipts: [],
    };

    const wrapper = mountPurchaseOrdersShell();

    expect(wrapper.find('[data-testid="purchase-order-open-shortage-modal"]').exists()).toBe(true);
  });

  it('hides receipt reversal entry on completed purchase orders even when a receipt still has reversal quantity', () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'completed',
      outstanding_qty: 0,
      ordered_qty: 10,
      received_qty: 10,
      cancelled_qty: 0,
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 0,
      estimated_tariff_cost: 0,
      items: [],
      receipts: [
        {
          id: 'receipt-1',
          product_name: 'Premium Canvas Bag',
          variant_sku: 'BAG-001',
          received_qty: 10,
          available_reversal_qty: 10,
          reversed_qty: 0,
          reversal_count: 0,
          received_at: Date.now(),
        },
      ],
    };

    const wrapper = mountPurchaseOrdersShell();

    expect(wrapper.find('[data-testid="purchase-order-open-reversal-modal"]').exists()).toBe(false);
  });

  it('hides cancel action once an ordered purchase order already has received quantity', () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'ordered',
      outstanding_qty: 8,
      ordered_qty: 10,
      received_qty: 2,
      cancelled_qty: 0,
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 0,
      estimated_tariff_cost: 0,
      items: [
        {
          id: 'item-1',
          quantity: 10,
          received_qty: 2,
          cancelled_qty: 0,
          product_name: 'Premium Canvas Bag',
          product_specifications: {},
          variant_options: {},
        },
      ],
      receipts: [],
    };

    const wrapper = mountPurchaseOrdersShell();

    expect(
      wrapper.get('[data-testid="purchase-order-detail-footer"]').findAll('button')
    ).toHaveLength(1);
  });

  it('hides cost-allocation action in the cost modal until the purchase order is completed', async () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'arrived',
      outstanding_qty: 0,
      ordered_qty: 10,
      received_qty: 10,
      cancelled_qty: 0,
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 20,
      estimated_tariff_cost: 10,
      actual_shipping_cost: 24,
      actual_tariff_cost: 12,
      items: [
        {
          id: 'item-1',
          quantity: 10,
          received_qty: 10,
          cancelled_qty: 0,
          product_name: 'Premium Canvas Bag',
          product_specifications: {},
          variant_options: {},
        },
      ],
      receipts: [],
    };

    const wrapper = mountPurchaseOrdersShell();
    await wrapper.get('[data-testid="purchase-order-open-cost-modal"]').trigger('click');

    expect(wrapper.get('[data-testid="purchase-order-cost-modal"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('执行成本分摊');
  });

  it('refreshes purchase-order detail context through the shared write-refresh helper after receipt reversal succeeds', async () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'arrived',
      outstanding_qty: 0,
      ordered_qty: 10,
      received_qty: 10,
      cancelled_qty: 0,
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 0,
      estimated_tariff_cost: 0,
      items: [
        {
          id: 'item-1',
          quantity: 10,
          received_qty: 10,
          cancelled_qty: 0,
          product_name: 'Premium Canvas Bag',
          product_specifications: {},
          variant_options: {},
        },
      ],
      receipts: [
        {
          id: 'receipt-1',
          product_name: 'Premium Canvas Bag',
          variant_sku: 'BAG-001',
          received_qty: 10,
          available_reversal_qty: 10,
          reversed_qty: 0,
          reversal_count: 0,
          received_at: Date.now(),
        },
      ],
    };

    const wrapper = mountPurchaseOrdersShell();
    await wrapper.get('[data-testid="purchase-order-open-reversal-modal"]').trigger('click');
    await wrapper.vm.submitReceiptReversal();

    expect(mocks.reverseReceipt).toHaveBeenCalledWith('po-1', 'receipt-1', { reason: undefined });
    expect(mocks.refreshPurchaseOrderViews).toHaveBeenCalledWith('po-1');
  });

  it('normalizes draft detail item numeric updates before sending the PATCH payload', async () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'draft',
      items: [{ id: 'item-1', quantity: 1, unit_cost: 50 }],
      receipts: [],
    };

    const wrapper = mountPurchaseOrdersShell();

    await wrapper.vm.handleDetailUpdateItem('item-1', 'quantity', '6');
    await wrapper.vm.handleDetailUpdateItem('item-1', 'unit_cost', '47');

    expect(mocks.updateItem).toHaveBeenNthCalledWith(1, 'po-1', 'item-1', { quantity: 6 });
    expect(mocks.updateItem).toHaveBeenNthCalledWith(2, 'po-1', 'item-1', { unit_cost: 47 });
    expect(mocks.refreshPurchaseOrderViews).toHaveBeenCalledWith('po-1');
  });

  it('force-refreshes purchase-order detail whenever the detail drawer is opened', async () => {
    const wrapper = mountPurchaseOrdersShell();

    await wrapper.vm.openDetail('po-1');

    expect(mocks.loadDetail).toHaveBeenCalledWith('po-1', { forceRefresh: true });
  });

  it('hides shortage-closure entry when no receivable lines remain', () => {
    mocks.detailState.detailLoading = false;
    mocks.detailState.detail = {
      id: 'po-1',
      po_no: 'PO-20260312-001',
      status: 'shipping',
      outstanding_qty: 0,
      ordered_qty: 10,
      received_qty: 8,
      cancelled_qty: 2,
      allocation_method: 'by_quantity',
      estimated_shipping_cost: 0,
      estimated_tariff_cost: 0,
      items: [
        {
          id: 'item-1',
          quantity: 10,
          received_qty: 8,
          cancelled_qty: 2,
          product_name: 'Premium Canvas Bag',
          product_specifications: {},
          variant_options: {},
        },
      ],
      receipts: [],
    };

    const wrapper = mountPurchaseOrdersShell();

    expect(wrapper.find('[data-testid="purchase-order-open-shortage-modal"]').exists()).toBe(false);
  });

  it('accepts selected orders from the current camelCase contract and ignores legacy snake_case-only payloads', async () => {
    mocks.detailState.detailLoading = false;

    const wrapper = mount(PurchaseOrders, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          OrderPickerModal: { template: '<div />' },
          ProductPickerModal: { template: '<div />' },
          ProductDetailModal: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppIcon: { template: '<i />' },
          AppFilterBar: { template: '<div />' },
          AppButton: { template: '<button><slot /></button>' },
          AppInput: {
            template: '<div />',
            props: ['modelValue', 'type', 'min', 'step', 'size', 'placeholder', 'disabled'],
          },
          AppCheckbox: { template: '<input type="checkbox" />' },
          AppSelect: appSelectStub,
          AppTable: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          MetricTile: { template: '<div />' },
          ManagementListShell: {
            template: '<div><slot name="actions" /><slot name="content" /></div>',
          },
        },
      },
    });

    await wrapper.vm.handleOrdersSelected([
      {
        id: 'order-camel',
        productId: 'prod-camel',
        variantId: 'var-camel',
        orderNo: 'SO-CAMEL',
        productName: 'Camel Product',
        quantity: 3,
        currentData: {
          name: 'Camel Product',
          variant_sku: 'SKU-CAMEL',
          brand: 'KK',
          cost_price: 18,
          images: ['https://example.com/camel.png'],
        },
      },
      {
        id: 'order-snake',
        product_id: 'prod-snake',
        variant_id: 'var-snake',
        order_no: 'SO-SNAKE',
        quantity: 2,
        current_data: JSON.stringify({
          name: 'Snake Product',
          variant_sku: 'SKU-SNAKE',
          brand: 'Legacy',
          cost_price: 9,
        }),
      },
    ]);

    expect(wrapper.vm.poItems).toHaveLength(1);
    expect(wrapper.vm.poItems[0]).toMatchObject({
      product_id: 'prod-camel',
      variant_id: 'var-camel',
      product_name: 'Camel Product',
      order_no: 'SO-CAMEL',
      quantity: 3,
      unit_cost: 18,
    });
  });

  it('falls back to list-item brand sku and main image when selected orders do not carry currentData', async () => {
    const wrapper = mountPurchaseOrdersShell();

    await wrapper.vm.handleOrdersSelected([
      {
        id: 'order-summary',
        productId: 'prod-summary',
        variantId: 'var-summary',
        orderNo: 'SO-SUMMARY',
        productName: 'Summary Product',
        brand: 'KK Summary',
        sku: 'SKU-SUMMARY',
        mainImage: '/file/summary-image',
        quantity: 2,
      },
    ]);

    expect(wrapper.vm.poItems).toHaveLength(1);
    expect(wrapper.vm.poItems[0]).toMatchObject({
      product_name: 'Summary Product',
      brand: 'KK Summary',
      sku: 'SKU-SUMMARY',
      image: '/file/summary-image',
    });
  });

  it('opens the created purchase-order detail when initial item insertion fails after creation', async () => {
    mocks.modalState.showDetail = false;
    mocks.modalState.showCreateModal = true;
    mocks.createPO.mockResolvedValueOnce({ id: 'po-partial' });
    mocks.addItems.mockResolvedValueOnce(false);

    const wrapper = mountPurchaseOrdersShell();
    wrapper.vm.poItems.push({
      product_id: 'prod-1',
      variant_id: 'var-1',
      product_name: 'Canvas Bag',
      quantity: 4,
      unit_cost: 12,
    });

    await wrapper.vm.executeCreate();

    expect(mocks.createPO).toHaveBeenCalledTimes(1);
    expect(mocks.addItems).toHaveBeenCalledWith('po-partial', [
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-1',
        quantity: 4,
      }),
    ]);
    expect(mocks.refreshPurchaseOrderViews).toHaveBeenCalledWith('po-partial');
    expect(wrapper.vm.showDetail).toBe(true);
    expect(mocks.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }));
  });

  it('resets selected suggestions when reopening the suggestions modal', async () => {
    mocks.modalState.showDetail = false;
    mocks.modalState.showSuggestions = true;

    const wrapper = mountPurchaseOrdersShell();
    wrapper.vm.selectedSuggestions = [
      { order_ids: ['old-order'], product_id: 'prod-old', variant_id: 'var-old' },
    ];

    wrapper.vm.showSuggestions = false;
    await wrapper.vm.$nextTick();

    wrapper.vm.showSuggestions = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.selectedSuggestions).toEqual([]);
  });

  it('warns instead of silently no-op when selected suggestions have no bindable orders', async () => {
    mocks.modalState.showDetail = false;
    mocks.modalState.showSuggestions = true;

    const wrapper = mountPurchaseOrdersShell();
    wrapper.vm.selectedSuggestions = [
      { order_ids: [], product_id: 'prod-1', variant_id: 'var-1', shortage: 6 },
    ];

    await wrapper.vm.handleCreateFromSuggestions();

    expect(mocks.createFromOrders).not.toHaveBeenCalled();
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warning',
      })
    );
  });
});
