import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import SpaceCreateModal from '../SpaceCreateModal.vue';

const mocks = vi.hoisted(() => ({
  createSpace: vi.fn(),
  createSubspace: vi.fn(),
  loadPermissions: vi.fn(),
  hasPermission: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useSpaces', () => ({
  useSpaces: () => ({
    createSpace: mocks.createSpace,
    createSubspace: mocks.createSubspace,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || '',
  }),
}));

vi.mock('@/composables/useAccessControl', () => ({
  useAccessControl: () => ({
    loadPermissions: mocks.loadPermissions,
    hasPermission: mocks.hasPermission,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast: mocks.addToast,
  }),
}));

describe('SpaceCreateModal unbind contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSpace.mockResolvedValue(true);
    mocks.createSubspace.mockResolvedValue(true);
    mocks.loadPermissions.mockResolvedValue([]);
    mocks.hasPermission.mockReturnValue(true);
  });

  function createWrapper() {
    return mount(SpaceCreateModal, {
      global: {
        stubs: {
          Modal: { template: '<div><slot /><slot name="footer" /></div>' },
          ProductBindingSection: { template: '<div />' },
          AppInput: { template: '<input />' },
          SpaceVisibilitySelector: { template: '<div />' },
          AppIcon: { template: '<div />' },
        },
      },
    });
  }

  it('clears both productId and variantId after unbinding a selected product', () => {
    const wrapper = createWrapper();

    wrapper.vm.handleProductSelect({
      id: 'prod-1',
      name: 'Product 1',
      selectedVariant: {
        id: 'var-1',
        sku: 'SKU-1',
      },
      images: [],
    });

    expect(wrapper.vm.form.productId).toBe('prod-1');
    expect(wrapper.vm.form.variantId).toBe('var-1');

    wrapper.vm.unbindProduct();

    expect(wrapper.vm.form.productId).toBe(null);
    expect(wrapper.vm.form.variantId).toBe(null);
  });

  it('prevents duplicate create submissions while the first request is still pending', async () => {
    let resolveCreate;
    mocks.createSpace.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    const wrapper = createWrapper();
    wrapper.vm.form.name = '新空间';

    const firstSubmit = wrapper.vm.handleSubmit();
    const secondSubmit = wrapper.vm.handleSubmit();
    await flushPromises();

    expect(mocks.createSpace).toHaveBeenCalledTimes(1);

    resolveCreate({ id: 'space-1' });
    await Promise.all([firstSubmit, secondSubmit]);
  });

  it('does not keep a half-bound product when initialProduct has no selectedVariant', async () => {
    const wrapper = mount(SpaceCreateModal, {
      props: {
        initialProduct: {
          id: 'prod-lite',
          name: 'Lite Product',
        },
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot /><slot name="footer" /></div>' },
          ProductBindingSection: { template: '<div />' },
          AppInput: { template: '<input />' },
          SpaceVisibilitySelector: { template: '<div />' },
          AppIcon: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.vm.form.productId).toBe(null);
    expect(wrapper.vm.form.variantId).toBe(null);
    expect(wrapper.vm.boundProduct).toBe(null);
  });

  it('blocks submit when product and variant binding are incomplete', async () => {
    const wrapper = createWrapper();
    wrapper.vm.form.name = '半绑定空间';
    wrapper.vm.form.template = 'product';
    wrapper.vm.form.productId = 'prod-1';
    wrapper.vm.form.variantId = null;

    await wrapper.vm.handleSubmit();

    expect(mocks.createSpace).not.toHaveBeenCalled();
    expect(mocks.createSubspace).not.toHaveBeenCalled();
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
      })
    );
  });
});
