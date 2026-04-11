import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductWorkflowModal from '../ProductWorkflowModal.vue';

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

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

describe('ProductWorkflowModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createWrapper(props = {}) {
    return mount(ProductWorkflowModal, {
      props: {
        show: true,
        product: {
          id: 'p-1',
          name: 'Lite Product',
        },
        ...props,
      },
      global: {
        stubs: {
          Modal: {
            template: '<div><slot name="header" /><slot /></div>',
            props: ['modelValue', 'title', 'size'],
          },
          ProductDetail: {
            template: '<div data-testid="product-detail">{{ product?.name }}</div>',
            props: ['product'],
          },
          ProductCreateModal: {
            template: '<div data-testid="product-form-panel">{{ initialData?.name }}</div>',
            props: ['modelValue', 'editMode', 'initialData', 'embedded'],
          },
          AppIcon: { template: '<i />' },
        },
      },
    });
  }

  it('keeps detail visible while preparing edit and then enters edit mode', async () => {
    let resolveHydration;
    mocks.loadProduct.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHydration = resolve;
        })
    );

    const wrapper = createWrapper();

    await wrapper.get('[data-testid="enter-edit"]').trigger('click');

    expect(wrapper.find('[data-testid="product-detail"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="edit-loading"]').exists()).toBe(true);

    resolveHydration({
      id: 'p-1',
      name: 'Hydrated Product',
      variants: [{ id: 'v-1', sku: 'SKU-1' }],
    });
    await flushPromises();
    await flushPromises();
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="product-form-panel"]').exists()).toBe(true);
    });

    expect(mocks.loadProduct).toHaveBeenCalledWith('p-1');
  });

  it('progressively hydrates detail content after opening with lite product data', async () => {
    let resolveHydration;
    mocks.loadProduct.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHydration = resolve;
        })
    );

    const wrapper = createWrapper();

    expect(wrapper.get('[data-testid="product-detail"]').text()).toContain('Lite Product');
    expect(wrapper.find('[data-testid="detail-loading"]').exists()).toBe(true);
    expect(mocks.loadProduct).toHaveBeenCalledWith('p-1');

    resolveHydration({
      id: 'p-1',
      name: 'Hydrated Detail Product',
      variants: [{ id: 'v-1', sku: 'SKU-1' }],
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="product-detail"]').text()).toContain('Hydrated Detail Product');
  });

  it('returns to detail with retryable error when edit hydration fails', async () => {
    mocks.loadProduct
      .mockRejectedValueOnce(new Error('detail down'))
      .mockRejectedValueOnce(new Error('network down'));

    const wrapper = createWrapper();
    await flushPromises();

    await wrapper.get('[data-testid="enter-edit"]').trigger('click');
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-testid="product-detail"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="edit-error"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="retry-edit"]').exists()).toBe(true);
  });

  it('ignores stale detail hydration results after switching to another product', async () => {
    let resolveFirst;
    mocks.loadProduct.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );

    const wrapper = createWrapper();

    await wrapper.setProps({
      product: {
        id: 'p-2',
        name: 'Second Product',
        variants: [{ id: 'v-2', sku: 'SKU-2' }],
      },
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

  it('clears edit hydration errors after switching to another product', async () => {
    mocks.loadProduct
      .mockRejectedValueOnce(new Error('detail down'))
      .mockRejectedValueOnce(new Error('network down'));

    const wrapper = createWrapper();

    await wrapper.get('[data-testid="enter-edit"]').trigger('click');
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-testid="edit-error"]').exists()).toBe(true);

    await wrapper.setProps({
      product: {
        id: 'p-2',
        name: 'Second Product',
        variants: [{ id: 'v-2', sku: 'SKU-2' }],
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="edit-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="product-detail"]').text()).toContain('Second Product');
  });
});
