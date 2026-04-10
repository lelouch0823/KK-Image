import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import ProductSelect from '../ProductSelect.vue';

const salesProducts = ref([]);

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
    products: ref([]),
    loadProducts: mocks.loadProducts,
    loading: ref(false),
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
});
