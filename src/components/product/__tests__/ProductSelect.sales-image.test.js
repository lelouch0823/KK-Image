import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import ProductSelect from '../ProductSelect.vue';

const salesProducts = ref([]);
const adminProducts = ref([]);
const adminError = ref('');

const mocks = vi.hoisted(() => ({
  loadSalesProducts: vi.fn(),
  retryLoadSalesProducts: vi.fn(),
  loadProducts: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || '',
  }),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    products: adminProducts,
    loadProducts: mocks.loadProducts,
    loading: ref(false),
    error: adminError,
  }),
}));

vi.mock('@/composables/useSalesProducts', () => ({
  useSalesProducts: () => ({
    products: salesProducts,
    loadSalesProducts: mocks.loadSalesProducts,
    retryLoadSalesProducts: mocks.retryLoadSalesProducts,
    loading: ref(false),
    error: ref(''),
  }),
}));

vi.mock('@vueuse/core', () => ({
  onClickOutside: vi.fn(),
  useDebounceFn: (fn) => fn,
}));

describe('ProductSelect sales image rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    salesProducts.value = [
      {
        id: 'prod-1',
        name: 'Desk',
        brand: 'ACME',
        series: 'Series A',
        primaryImage: 'https://cdn.example.com/desk.png',
      },
    ];
    adminProducts.value = [];
    adminError.value = '';
  });

  it('keeps absolute sales product image urls intact', async () => {
    const wrapper = mount(ProductSelect, {
      props: {
        mode: 'sales',
        token: 'sales-token',
      },
      global: {
        stubs: {
          AppIcon: { template: '<div />' },
          AppImage: {
            props: ['src'],
            template: '<img :src="src" data-testid="product-image" />',
          },
        },
      },
    });

    await wrapper.find('input').trigger('focus');

    expect(wrapper.find('[data-testid="product-image"]').attributes('src')).toBe(
      'https://cdn.example.com/desk.png'
    );
  });

  it('shows admin load errors locally and retries the current admin search', async () => {
    mocks.loadProducts.mockImplementation(async () => {
      adminError.value = 'Admin load failed';
      return false;
    });

    const wrapper = mount(ProductSelect, {
      props: {
        mode: 'admin',
      },
      global: {
        stubs: {
          AppIcon: { template: '<div />' },
          AppImage: { template: '<img />' },
        },
      },
    });

    const input = wrapper.find('input');
    await input.setValue('desk');
    await input.trigger('focus');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Admin load failed');
    expect(wrapper.emitted('load-error')?.[0]?.[0]).toBe('Admin load failed');

    await wrapper.get('[data-testid="unified-product-retry"]').trigger('click');

    expect(mocks.loadProducts).toHaveBeenCalledTimes(2);
    expect(mocks.loadProducts).toHaveBeenNthCalledWith(1, { search: 'desk', limit: 10, page: 1 });
    expect(mocks.loadProducts).toHaveBeenNthCalledWith(2, { search: 'desk', limit: 10, page: 1 });
  });

  it('reloads products when the sales token changes even if old results are still cached', async () => {
    const wrapper = mount(ProductSelect, {
      props: {
        mode: 'sales',
        token: 'sales-token-a',
      },
      global: {
        stubs: {
          AppIcon: { template: '<div />' },
          AppImage: { template: '<img />' },
        },
      },
    });

    await wrapper.find('input').trigger('focus');
    expect(mocks.loadSalesProducts).toHaveBeenCalledTimes(1);
    expect(mocks.loadSalesProducts).toHaveBeenLastCalledWith('sales-token-a', {
      search: '',
      page: 1,
      limit: 12,
    });

    wrapper.vm.isOpen = false;
    await wrapper.setProps({ token: 'sales-token-b' });
    await wrapper.find('input').trigger('focus');

    expect(mocks.loadSalesProducts).toHaveBeenCalledTimes(2);
    expect(mocks.loadSalesProducts).toHaveBeenLastCalledWith('sales-token-b', {
      search: '',
      page: 1,
      limit: 12,
    });
  });
});
