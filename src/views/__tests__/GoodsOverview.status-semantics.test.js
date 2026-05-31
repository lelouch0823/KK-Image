import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import { mount } from '@vue/test-utils';
import GoodsOverview from '../GoodsOverview.vue';

const mocks = vi.hoisted(() => ({
  useGoodsOverview: vi.fn(),
  addToast: vi.fn(),
  setContext: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => {
      const map = {
        'goodsOverview.permissionDenied': '商品总览权限不足',
        'goodsOverview.permissionDeniedDesc': '当前账号缺少 products:manage 权限，请联系管理员。',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useAI', () => ({
  useAI: () => ({ setContext: mocks.setContext }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/composables/useGoodsOverview', () => ({
  useGoodsOverview: mocks.useGoodsOverview,
}));

function createComposableState(itemOverrides = {}) {
  const summary =
    itemOverrides.summaryOverride !== undefined
      ? itemOverrides.summaryOverride
      : null;
  const item = {
    id: 'variant-1',
    variantId: 'variant-1',
    productId: 'product-1',
    name: 'Demo Variant',
    sku: 'SKU-1',
    stockQuantity: 12,
    availableQuantity: 3,
    alertThreshold: 5,
    shortage: 0,
    confirmedQty: 0,
    productionQty: 0,
    shippingQty: 0,
    arrivedQty: 0,
    totalDemand: 0,
    avgUnitCost: 0,
    avgFreight: 0,
    landedCost: 0,
    images: [],
    ...itemOverrides,
  };

  return {
    items: ref([item]),
    summary: ref(summary),
    loading: ref(false),
    error: ref(itemOverrides.errorOverride ?? null),
    errorCode: ref(itemOverrides.errorCodeOverride ?? null),
    filters: {
      brand: '',
      category: '',
      shortageOnly: false,
      sort: 'shortage',
    },
    availableFilters: ref({
      categories: [],
      brands: [],
    }),
    selectedItems: ref(itemOverrides.selectedItemsOverride ?? []),
    isAllSelected: computed(() => false),
    toggleSelect: vi.fn(),
    toggleSelectAll: vi.fn(),
    isSelected: vi.fn(() => false),
    clearSelection: vi.fn(),
    exportCSV: vi.fn(),
    createPOFromSelected: vi.fn(),
    isCreatingPO: ref(false),
    init: vi.fn(),
  };
}

function createWrapper(itemOverrides) {
  mocks.useGoodsOverview.mockReturnValue(createComposableState(itemOverrides));

  return mount(GoodsOverview, {
    global: {
      stubs: {
        ManagementListShell: { template: '<div><slot name="actions" /><slot name="filters" /><slot name="content" /></div>' },
        AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
        AppIcon: { template: '<i />' },
        AppCheckbox: { template: '<input type="checkbox" />', props: ['modelValue', 'checked'] },
        FilterSelect: { template: '<select />', props: ['modelValue', 'options', 'placeholder'] },
        MetricTile: { template: '<div><slot name="meta" /></div>' },
        SummaryStrip: { template: '<div><slot /></div>' },
        FloatingSelectionBar: { template: '<div><slot name="summary" /><slot /></div>', props: ['visible'] },
        PermissionDeniedState: {
          template: '<div data-testid="goods-overview-forbidden" :data-description="description" />',
          props: ['title', 'description', 'homeTo', 'homeText'],
        },
        EmptyState: { template: '<div data-testid="goods-overview-error-state"><slot name="action" /></div>' },
        AppImage: { template: '<img data-testid="overview-image" :src="src" />', props: ['src'] },
        AppTable: {
          props: ['data'],
          template: `
            <div data-testid="goods-overview-table">
              <div v-for="row in data" :key="row.id">
                <slot name="cell-name" :row="row" />
                <slot name="cell-status" :row="row" />
              </div>
            </div>
          `,
        },
        AppTableStatusPill: {
          template: '<div data-testid="status-badge" :data-variant="variant">{{ label }}</div>',
          props: ['variant', 'label'],
        },
      },
    },
  });
}

describe('GoodsOverview status semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks warning when available stock drops below threshold even if on-hand stock is still sufficient', () => {
    const wrapper = createWrapper({
      shortage: 0,
      stockQuantity: 12,
      availableQuantity: 3,
      alertThreshold: 5,
    });

    expect(wrapper.get('[data-testid="status-badge"]').attributes('data-variant')).toBe('warning');
  });

  it('renders full image urls without forcing a /file prefix in the overview list', () => {
    const wrapper = createWrapper({
      images: ['https://example.com/history-cover.png'],
    });

    expect(wrapper.get('[data-testid="overview-image"]').attributes('src')).toBe(
      'https://example.com/history-cover.png'
    );
  });

  it('reads filter options from the composable ref without crashing', () => {
    expect(() =>
      createWrapper({
        images: [],
      })
    ).not.toThrow();
  });

  it('does not crash when summary payload is missing byStatus details', () => {
    expect(() =>
      createWrapper({
        summaryOverride: {
          totalProducts: 12,
          totalDemand: 20,
          shortageCount: 3,
        },
      })
    ).not.toThrow();
  });

  it('shows a retryable error state instead of a silent empty table on network failures', () => {
    const wrapper = createWrapper({
      errorOverride: 'network down',
      errorCodeOverride: 'NETWORK_ERROR',
    });

    expect(wrapper.find('[data-testid="goods-overview-error-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="goods-overview-table"]').exists()).toBe(false);
  });

  it('uses the real products:manage permission name in the forbidden fallback copy', () => {
    const wrapper = createWrapper({
      errorOverride: null,
      errorCodeOverride: 'FORBIDDEN',
    });

    expect(wrapper.get('[data-testid="goods-overview-forbidden"]').attributes('data-description')).toContain('products:manage');
  });

  it('navigates to the named purchase-orders admin route after creating a purchase order', async () => {
    const wrapper = createWrapper({
      selectedItemsOverride: [
        {
          id: 'variant-1',
          variantId: 'variant-1',
        },
      ],
    });
    const state = mocks.useGoodsOverview.mock.results.at(-1)?.value;
    state.createPOFromSelected.mockResolvedValue({
      success: true,
      data: { id: 'po-123' },
    });

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('goodsOverview.batch.createPO'))
      ?.trigger('click');

    expect(mocks.push).toHaveBeenCalledWith({
      name: 'PurchaseOrders',
      query: { id: 'po-123', variantId: 'variant-1' },
    });
  });
});
