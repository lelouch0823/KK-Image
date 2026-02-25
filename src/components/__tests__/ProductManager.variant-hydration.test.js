import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, reactive } from 'vue';
import ProductManager from '../ProductManager.vue';

const mocks = vi.hoisted(() => ({
  loadProduct: vi.fn(),
  loadProducts: vi.fn(),
  deleteProduct: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    products: ref([]),
    loading: ref(false),
    error: ref(''),
    pagination: reactive({ page: 1, totalPages: 1 }),
    loadProducts: mocks.loadProducts,
    loadProduct: mocks.loadProduct,
    deleteProduct: mocks.deleteProduct,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

describe('ProductManager variant hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadProducts.mockResolvedValue();
    mocks.deleteProduct.mockResolvedValue(true);
  });

  function createWrapper() {
    return mount(ProductManager, {
      global: {
        stubs: {
          ProductStats: { template: '<div />' },
          ProductFilters: { template: '<div />' },
          ProductTable: { template: '<div />' },
          ProductCreateModal: { template: '<div />' },
          ProductDetailModal: { template: '<div><slot name="header-actions" :product="{}" /></div>' },
          ProductImportModal: { template: '<div />' },
          ProductGrid: { template: '<div />' },
          SpaceCreateModal: { template: '<div />' },
          Pagination: { template: '<div />' },
          EmptyState: { template: '<div><slot name="action" /></div>' },
          Modal: { template: '<div><slot /></div>' },
        },
      },
    });
  }

  it('handleShare should hydrate product and attach selectedVariant', async () => {
    mocks.loadProduct.mockResolvedValue({
      id: 'p-1',
      name: 'Hydrated',
      images: ['img-1'],
      variants: [{ id: 'v-1', sku: 'SKU-1', status: 'active', image_id: 'img-v1' }],
    });

    const wrapper = createWrapper();
    await wrapper.vm.handleShare({ id: 'p-1', name: 'Lite' });

    expect(mocks.loadProduct).toHaveBeenCalledWith('p-1');
    expect(wrapper.vm.showShareModal).toBe(true);
    expect(wrapper.vm.sharingProduct.selectedVariant.id).toBe('v-1');
  });

  it('handleEditFromDetail should use hydration path', async () => {
    mocks.loadProduct.mockResolvedValue({
      id: 'p-2',
      name: 'Hydrated 2',
      variants: [{ id: 'v-2', sku: 'SKU-2', status: 'active' }],
    });

    const wrapper = createWrapper();
    await wrapper.vm.handleEditFromDetail({ id: 'p-2', name: 'Lite 2' });

    expect(mocks.loadProduct).toHaveBeenCalledWith('p-2');
    expect(wrapper.vm.isEditMode).toBe(true);
    expect(wrapper.vm.showCreateModal).toBe(true);
    expect(wrapper.vm.editingProduct.id).toBe('p-2');
  });
});
