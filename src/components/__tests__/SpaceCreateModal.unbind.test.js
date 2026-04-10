import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SpaceCreateModal from '../SpaceCreateModal.vue';

const mocks = vi.hoisted(() => ({
  createSpace: vi.fn(),
  createSubspace: vi.fn(),
  loadPermissions: vi.fn(),
  hasPermission: vi.fn(),
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
});
