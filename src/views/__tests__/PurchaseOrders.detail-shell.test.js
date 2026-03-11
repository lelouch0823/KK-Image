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
    detail: ref(null),
    detailLoading: ref(true),
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
});
