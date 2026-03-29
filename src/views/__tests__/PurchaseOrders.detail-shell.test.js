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
  loadSuggestions: vi.fn(),
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
    list: ref([]),
    total: ref(0),
    loading: ref(false),
    error: ref(''),
    errorCode: ref(''),
    detail: computed(() => mocks.detailState.detail),
    detailLoading: computed(() => mocks.detailState.detailLoading),
    suggestions: ref([]),
    suggestionsLoading: ref(false),
    stats: ref(null),
    filters: reactive({ status: '', page: 1, limit: 20 }),
    statusConfig: computed(() => ({})),
    loadList: mocks.loadList,
    loadStats: mocks.loadStats,
    loadDetail: mocks.loadDetail,
    createPO: vi.fn(),
    createFromOrders: vi.fn(),
    updatePO: vi.fn(),
    updateStatus: vi.fn(),
    loadSuggestions: mocks.loadSuggestions,
    addItems: vi.fn(),
    removeItem: vi.fn(),
    updateItem: vi.fn(),
    allocateCosts: vi.fn(),
  }),
}));

vi.mock('@/composables/usePurchaseOrderModals', () => ({
  usePurchaseOrderModals: () => ({
    showDetail: ref(true),
    showCreateModal: ref(false),
    showSuggestions: ref(false),
    showOrderPicker: ref(false),
    showProductPicker: ref(false),
    pickerTarget: ref('create'),
    showShortageConfirm: ref(false),
    confirmData: reactive({ show: false, title: '', message: '', type: 'primary', loading: false, onConfirm: vi.fn() }),
    viewProductId: ref(null),
    detailFocusedVariantId: vi.fn(() => null),
    openOrderPicker: vi.fn(),
    openProductPicker: vi.fn(),
    closeDetail: vi.fn(),
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('@/composables/useAI', () => ({
  useAI: () => ({ setContext: vi.fn() }),
}));

vi.mock('@/composables/useAppRefreshBus', () => ({
  useAppRefreshBus: () => ({ subscribeModule: vi.fn(() => vi.fn()) }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/purchase-orders', query: mocks.routeQuery }),
  useRouter: () => ({ replace: mocks.routerReplace, push: mocks.routerPush }),
}));

describe('PurchaseOrders detail shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.routeQuery = {};
    mocks.detailState.detail = null;
    mocks.detailState.detailLoading = true;
    mocks.loadList.mockResolvedValue();
    mocks.loadStats.mockResolvedValue();
    mocks.loadDetail.mockResolvedValue();
    mocks.loadSuggestions.mockResolvedValue();
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
          AppInput: { template: '<input />' },
          AppCheckbox: { template: '<input type="checkbox" />' },
          AppSelect: { template: '<select />' },
          AppTable: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          MetricTile: { template: '<div />' },
          ManagementListShell: { template: '<div><slot name="actions" /><slot name="content" /></div>' },
        },
      },
    });

    expect(wrapper.find('[data-testid="purchase-order-detail-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-progress"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-cost"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-items"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-footer"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-status-chip"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-item-card"]').exists()).toBe(true);
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
          AppInput: { template: '<input />' },
          AppCheckbox: { template: '<input type="checkbox" />' },
          AppSelect: { template: '<select />' },
          AppTable: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          MetricTile: { template: '<div />' },
          ManagementListShell: { template: '<div><slot name="actions" /><slot name="content" /></div>' },
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
});
