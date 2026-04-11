import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
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

    await flushPromises();

    expect(mocks.loadProduct).toHaveBeenCalledWith('p-1');
    wrapper.unmount();
  });

  it('re-emits close when inner modal closes', async () => {
    const wrapper = mount(ProductDetailModal, {
      props: {
        show: true,
        productId: 'p-1',
        initialData: { id: 'p-1', name: 'Lite Product' },
      },
      global: {
        stubs: {
          Modal: {
            template: '<div><button data-testid="close" @click="$emit(\'close\')">close</button><slot /></div>',
            props: ['modelValue'],
          },
          ProductDetail: { template: '<div />', props: ['product'] },
        },
      },
    });

    await wrapper.get('[data-testid="close"]').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('ignores stale fetch results after switching product ids', async () => {
    let resolveFirst;
    mocks.loadProduct
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({
        id: 'p-2',
        name: 'Second Product',
        variants: [{ id: 'v-2', sku: 'SKU-2' }],
      });

    const wrapper = mount(ProductDetailModal, {
      props: {
        show: true,
        productId: 'p-1',
        initialData: { id: 'p-1', name: 'First Product' },
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot /></div>', props: ['modelValue'] },
          ProductDetail: {
            template: '<div data-testid="product-detail">{{ product?.name }}</div>',
            props: ['product'],
          },
        },
      },
    });

    await wrapper.setProps({
      productId: 'p-2',
      initialData: { id: 'p-2', name: 'Second Lite Product' },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="product-detail"]').text()).toContain('Second Product');

    resolveFirst({
      id: 'p-1',
      name: 'Stale Product',
      variants: [{ id: 'v-1', sku: 'SKU-1' }],
    });
    await flushPromises();
    await flushPromises();

    expect(wrapper.get('[data-testid="product-detail"]').text()).toContain('Second Product');
    expect(wrapper.get('[data-testid="product-detail"]').text()).not.toContain('Stale Product');
  });

  it('reloads detail when productId changes without initialData', async () => {
    mocks.loadProduct
      .mockResolvedValueOnce({
        id: 'p-1',
        name: 'First Product',
        variants: [{ id: 'v-1', sku: 'SKU-1' }],
      })
      .mockResolvedValueOnce({
        id: 'p-2',
        name: 'Second Product',
        variants: [{ id: 'v-2', sku: 'SKU-2' }],
      });

    const wrapper = mount(ProductDetailModal, {
      props: {
        show: true,
        productId: 'p-1',
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot /></div>', props: ['modelValue'] },
          ProductDetail: {
            template: '<div data-testid="product-detail">{{ product?.name }}</div>',
            props: ['product'],
          },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-testid="product-detail"]').text()).toContain('First Product');

    await wrapper.setProps({ productId: 'p-2' });
    await flushPromises();

    expect(mocks.loadProduct).toHaveBeenNthCalledWith(2, 'p-2');
    expect(wrapper.get('[data-testid="product-detail"]').text()).toContain('Second Product');
  });

  it('keeps initial product snapshot visible when background hydration fails', async () => {
    mocks.loadProduct.mockResolvedValueOnce(null);

    const wrapper = mount(ProductDetailModal, {
      props: {
        show: true,
        productId: 'p-1',
        initialData: { id: 'p-1', name: 'Lite Product' },
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot /></div>', props: ['modelValue'] },
          ProductDetail: {
            template: '<div data-testid="product-detail">{{ product?.name }}</div>',
            props: ['product'],
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-testid="product-detail"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="product-detail"]').text()).toContain('Lite Product');
    expect(wrapper.text()).not.toContain('common.error.network_error');
  });
});
