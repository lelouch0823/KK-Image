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
  useI18n: () => ({ t: (key) => key }),
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
    error: ref(null),
    errorCode: ref(null),
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
    selectedItems: ref([]),
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
        PermissionDeniedState: { template: '<div />' },
        AppImage: { template: '<img data-testid="overview-image" :src="src" />', props: ['src'] },
        AppTable: {
          props: ['data'],
          template: `
            <div>
              <div v-for="row in data" :key="row.id">
                <slot name="cell-name" :row="row" />
                <slot name="cell-status" :row="row" />
              </div>
            </div>
          `,
        },
        StatusBadge: {
          template: '<div data-testid="status-badge" :data-status="status">{{ text }}</div>',
          props: ['status', 'text'],
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

    expect(wrapper.get('[data-testid="status-badge"]').attributes('data-status')).toBe('warning');
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
});
