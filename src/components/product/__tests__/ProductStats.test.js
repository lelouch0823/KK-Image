import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive, ref } from 'vue';
import ProductStats from '../ProductStats.vue';

const state = {
  products: ref([]),
  pagination: reactive({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  }),
};

const mocks = vi.hoisted(() => ({
  loadProducts: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    products: state.products,
    pagination: state.pagination,
    loadProducts: mocks.loadProducts,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

describe('ProductStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.products.value = [];
    state.pagination.page = 1;
    state.pagination.limit = 20;
    state.pagination.total = 0;
    state.pagination.totalPages = 1;

    mocks.loadProducts.mockImplementation(async (params) => {
      if (params.page === 1) {
        state.products.value = [
          { id: 'p-1', cost_price: 5, stock_quantity: 2, alert_threshold: 3 },
          { id: 'p-2', cost_price: 7, stock_quantity: 1, alert_threshold: 5 },
        ];
        state.pagination.page = 1;
        state.pagination.limit = 2;
        state.pagination.total = 3;
        state.pagination.totalPages = 2;
        return true;
      }

      state.products.value = [
        { id: 'p-3', cost_price: 10, stock_quantity: 4, alert_threshold: 2 },
      ];
      state.pagination.page = 2;
      state.pagination.limit = 2;
      state.pagination.total = 3;
      state.pagination.totalPages = 2;
      return true;
    });
  });

  it('loads all filtered pages and computes metrics from the full result set', async () => {
    const wrapper = mount(ProductStats, {
      props: {
        active: true,
        filters: {
          status: 'active',
          brand: 'ACME',
        },
      },
      global: {
        stubs: {
          MetricTile: {
            props: ['label', 'value', 'meta'],
            template: `
              <div class="metric">
                <div class="label">{{ label }}</div>
                <div class="value"><slot name="value">{{ value }}</slot></div>
                <div class="meta">{{ meta }}</div>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    expect(mocks.loadProducts).toHaveBeenCalledTimes(2);
    expect(mocks.loadProducts).toHaveBeenNthCalledWith(1, {
      search: '',
      status: 'active',
      brand: 'ACME',
      category: '',
      hasStock: '',
      sortBy: '',
      sortOrder: '',
      page: 1,
      limit: 100,
    }, true);
    expect(mocks.loadProducts).toHaveBeenNthCalledWith(2, {
      search: '',
      status: 'active',
      brand: 'ACME',
      category: '',
      hasStock: '',
      sortBy: '',
      sortOrder: '',
      page: 2,
      limit: 100,
    }, true);

    const text = wrapper.text();
    expect(text).toContain('3');
    expect(text).toContain('2');
    expect(text).toContain('57');
  });

  it('keeps latest filter stats when earlier load resolves late', async () => {
    let resolveOldFilter;
    mocks.loadProducts.mockImplementation((params) => {
      if (params.brand === 'Legacy') {
        return new Promise((resolve) => {
          resolveOldFilter = () => {
            state.products.value = [
              { id: 'p-old', cost_price: 9, stock_quantity: 1, alert_threshold: 3 },
            ];
            state.pagination.page = 1;
            state.pagination.limit = 1;
            state.pagination.total = 1;
            state.pagination.totalPages = 1;
            resolve(true);
          };
        });
      }

      state.products.value = [
        { id: 'p-new', cost_price: 5, stock_quantity: 4, alert_threshold: 2 },
      ];
      state.pagination.page = 1;
      state.pagination.limit = 1;
      state.pagination.total = 1;
      state.pagination.totalPages = 1;
      return Promise.resolve(true);
    });

    const wrapper = mount(ProductStats, {
      props: {
        active: true,
        filters: {
          brand: 'Legacy',
        },
      },
      global: {
        stubs: {
          MetricTile: {
            props: ['label', 'value', 'meta'],
            template: `
              <div class="metric">
                <div class="label">{{ label }}</div>
                <div class="value"><slot name="value">{{ value }}</slot></div>
                <div class="meta">{{ meta }}</div>
              </div>
            `,
          },
        },
      },
    });

    await wrapper.setProps({
      filters: {
        brand: 'Current',
      },
    });
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('20');
    expect(wrapper.text()).toContain('0');

    resolveOldFilter();
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('20');
    expect(wrapper.text()).not.toContain('9');
  });

  it('clears stale metrics when the latest stats refresh fails', async () => {
    mocks.loadProducts.mockImplementation(async (params) => {
      if (params.brand === 'Broken') {
        return false;
      }

      state.products.value = [
        { id: 'p-1', cost_price: 10, stock_quantity: 2, alert_threshold: 3 },
      ];
      state.pagination.page = 1;
      state.pagination.limit = 1;
      state.pagination.total = 1;
      state.pagination.totalPages = 1;
      return true;
    });

    const wrapper = mount(ProductStats, {
      props: {
        active: true,
        filters: {
          brand: 'Healthy',
        },
      },
      global: {
        stubs: {
          MetricTile: {
            props: ['label', 'value', 'meta'],
            template: `
              <div class="metric">
                <div class="label">{{ label }}</div>
                <div class="value"><slot name="value">{{ value }}</slot></div>
                <div class="meta">{{ meta }}</div>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    expect(wrapper.vm.totalFormatted).toBe('1');
    expect(wrapper.vm.lowStockCount).toBe(1);
    expect(wrapper.vm.valueFormatted).toBe('20');

    await wrapper.setProps({
      filters: {
        brand: 'Broken',
      },
    });
    await flushPromises();
    await flushPromises();

    expect(wrapper.vm.totalFormatted).toBe('0');
    expect(wrapper.vm.lowStockCount).toBe(0);
    expect(wrapper.vm.valueFormatted).toBe('0');
  });

  it('prefers available_quantity when computing low-stock counts', async () => {
    mocks.loadProducts.mockImplementation(async () => {
      state.products.value = [
        { id: 'p-1', cost_price: 5, stock_quantity: 10, available_quantity: 2, alert_threshold: 3 },
        { id: 'p-2', cost_price: 7, stock_quantity: 8, available_quantity: 1, alert_threshold: 5 },
      ];
      state.pagination.page = 1;
      state.pagination.limit = 2;
      state.pagination.total = 2;
      state.pagination.totalPages = 1;
      return true;
    });

    const wrapper = mount(ProductStats, {
      props: {
        active: true,
        filters: {},
      },
      global: {
        stubs: {
          MetricTile: {
            props: ['label', 'value', 'meta'],
            template: `
              <div class="metric">
                <div class="label">{{ label }}</div>
                <div class="value"><slot name="value">{{ value }}</slot></div>
                <div class="meta">{{ meta }}</div>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    expect(wrapper.vm.lowStockCount).toBe(2);
  });
});
