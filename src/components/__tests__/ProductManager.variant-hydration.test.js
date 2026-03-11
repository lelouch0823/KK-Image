import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, reactive } from 'vue';
import ProductManager from '../ProductManager.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const mocks = vi.hoisted(() => ({
  loadProduct: vi.fn(),
  loadProducts: vi.fn(),
  deleteProduct: vi.fn(),
  routeQuery: {},
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
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
  useRoute: () => ({ query: mocks.routeQuery }),
  useRouter: () => ({ replace: mocks.routerReplace, push: mocks.routerPush }),
}));

describe('ProductManager variant hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.routeQuery = {};
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
          ProductWorkflowModal: {
            template: '<div data-testid="workflow-modal" />',
            props: ['show', 'product'],
          },
          ProductImportModal: { template: '<div />' },
          ProductExportModal: { template: '<div />' },
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

  it('handleEditWithHydration should use hydration path', async () => {
    mocks.loadProduct.mockResolvedValue({
      id: 'p-2',
      name: 'Hydrated 2',
      variants: [{ id: 'v-2', sku: 'SKU-2', status: 'active' }],
    });

    const wrapper = createWrapper();
    await wrapper.vm.handleEditWithHydration({ id: 'p-2', name: 'Lite 2' });

    expect(mocks.loadProduct).toHaveBeenCalledWith('p-2');
    expect(wrapper.vm.isEditMode).toBe(true);
    expect(wrapper.vm.showCreateModal).toBe(true);
    expect(wrapper.vm.editingProduct.id).toBe('p-2');
  });

  it('renders product workflow modal instead of separate detail modal', () => {
    const wrapper = createWrapper();

    expect(wrapper.find('[data-testid="workflow-modal"]').exists()).toBe(true);
    expect(wrapper.html()).not.toContain('header-actions');
  });

  it('opens workflow detail immediately without pre-hydrating product detail', async () => {
    let resolveLoad;
    mocks.loadProduct.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        })
    );

    const wrapper = createWrapper();
    const pending = wrapper.vm.handleView({ id: 'p-9', name: 'Quick View' });

    expect(wrapper.vm.showDetailModal).toBe(true);
    expect(wrapper.vm.viewingProduct).toEqual({ id: 'p-9', name: 'Quick View', mainImage: null });
    expect(mocks.loadProduct).not.toHaveBeenCalled();

    resolveLoad?.({
      id: 'p-9',
      name: 'Hydrated View',
      variants: [{ id: 'v-9', sku: 'SKU-9', status: 'active' }],
    });
    await pending;
  });

  it('renders header action icons for create/import/export/stats', () => {
    const wrapper = createWrapper();
    const iconNames = wrapper.findAllComponents(AppIcon).map((icon) => icon.props('name'));

    expect(iconNames).toEqual(expect.arrayContaining([
      'plus',
      'arrow-up-tray',
      'arrow-down-tray',
      'chart-bar',
    ]));
  });

  it('handleModalSuccess refreshes with current filters and bypasses cache', async () => {
    const wrapper = createWrapper();
    wrapper.vm.filters.search = 'sneaker';
    wrapper.vm.filters.status = 'active';
    wrapper.vm.pagination.page = 2;

    await wrapper.vm.handleModalSuccess();

    expect(mocks.loadProducts).toHaveBeenLastCalledWith(
      { page: 2, status: 'active', search: 'sneaker' },
      true
    );
  });

  it('preserves query.edit when edit hydration fails during auto-open', async () => {
    mocks.routeQuery = { edit: 'p-404' };
    mocks.loadProduct.mockResolvedValue(null);

    createWrapper();
    await vi.waitFor(() => {
      expect(mocks.loadProduct).toHaveBeenCalledWith('p-404');
    });

    expect(mocks.routerReplace).not.toHaveBeenCalled();
  });
});
