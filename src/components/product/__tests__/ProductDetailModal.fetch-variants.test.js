import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductDetailModal from '../ProductDetailModal.vue';

const mocks = vi.hoisted(() => ({
  loadProduct: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    loadProduct: mocks.loadProduct,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

describe('ProductDetailModal variant hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadProduct.mockResolvedValue({
      id: 'p-1',
      name: 'Full Product',
      variants: [{ id: 'v-1', sku: 'SKU-1' }],
    });
  });

  it('fetches full product when initialData lacks variants', async () => {
    const wrapper = mount(ProductDetailModal, {
      props: {
        show: true,
        productId: 'p-1',
        initialData: { id: 'p-1', name: 'Lite Product' },
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot /></div>', props: ['modelValue'] },
          ProductDetail: { template: '<div />', props: ['product'] },
        },
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.loadProduct).toHaveBeenCalledWith('p-1');
    wrapper.unmount();
  });
});
