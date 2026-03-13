import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import ProductManager from '../ProductManager.vue';

const mocks = vi.hoisted(() => ({
  products: { value: [] },
  availableFilters: { value: { brands: [], categories: [] } },
  pagination: { page: 2, totalPages: 3 },
  loadProduct: vi.fn(),
  loadProducts: vi.fn(),
  deleteProduct: vi.fn(),
  routeQuery: {},
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    products: mocks.products,
    availableFilters: mocks.availableFilters,
    loading: ref(false),
    error: ref(''),
    errorCode: ref(null),
    pagination: mocks.pagination,
    loadProducts: mocks.loadProducts,
    loadProduct: mocks.loadProduct,
    deleteProduct: mocks.deleteProduct,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useAI', () => ({
  useAI: () => ({ setContext: vi.fn() }),
}));

vi.mock('@/composables/useAppRefreshBus', () => ({
  useAppRefreshBus: () => ({ subscribeModule: () => vi.fn() }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
  useRouter: () => ({ replace: mocks.routerReplace, push: mocks.routerPush }),
}));

describe('ProductManager create success UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.products.value = [];
    mocks.availableFilters.value = { brands: [], categories: [] };
    mocks.pagination.page = 2;
    mocks.pagination.totalPages = 3;
    mocks.routeQuery = {};
    mocks.loadProducts.mockResolvedValue();
    mocks.deleteProduct.mockResolvedValue(true);
  });

  function createWrapper() {
    return mount(ProductManager, {
      global: {
        stubs: {
          ManagementListShell: { template: '<div><slot name="actions" /><slot name="filters" /><slot name="content" /><slot /></div>' },
          ProductStats: { template: '<div />' },
          ProductFilters: { template: '<div />' },
          ProductTable: { template: '<div />' },
          ProductCreateModal: { template: '<div />', props: ['modelValue'] },
          ProductWorkflowModal: {
            template: '<div />',
            props: ['show', 'product'],
          },
          ProductImportModal: { template: '<div />' },
          ProductExportModal: { template: '<div />' },
          ProductGrid: { template: '<div />' },
          SpaceCreateModal: { template: '<div />' },
          Pagination: { template: '<div />' },
          EmptyState: { template: '<div><slot name="action" /></div>' },
          Modal: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          AppIcon: { template: '<div />' },
        },
      },
    });
  }

  it('resets to page 1 and opens the created product when it is visible after reload', async () => {
    mocks.loadProducts.mockImplementation(async () => {
      mocks.products.value = [{ id: 'p-created', name: 'Created Product' }];
      mocks.pagination.page = 1;
    });

    const wrapper = createWrapper();
    await wrapper.vm.handleModalSuccess({ id: 'p-created' });

    expect(mocks.loadProducts).toHaveBeenLastCalledWith(
      { page: 1 },
      true
    );
    expect(wrapper.vm.pagination.page).toBe(1);
    expect(wrapper.vm.viewingProduct.id).toBe('p-created');
    expect(wrapper.vm.showDetailModal).toBe(true);
  });

  it('keeps filters and shows an info toast when the created product is hidden', async () => {
    mocks.loadProducts.mockImplementation(async () => {
      mocks.products.value = [{ id: 'p-other', name: 'Other Product' }];
      mocks.pagination.page = 1;
    });

    const wrapper = createWrapper();
    wrapper.vm.filters.search = 'shoe';
    wrapper.vm.filters.status = 'active';

    await wrapper.vm.handleModalSuccess({ id: 'p-created' });

    expect(wrapper.vm.filters.search).toBe('shoe');
    expect(wrapper.vm.filters.status).toBe('active');
    expect(mocks.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
  });

  it('preserves extended filters and sorting when refreshing the list', async () => {
    const wrapper = createWrapper();
    wrapper.vm.filters.search = 'shoe';
    wrapper.vm.filters.status = 'active';
    wrapper.vm.filters.brand = 'KK';
    wrapper.vm.filters.category = 'Top';
    wrapper.vm.filters.hasStock = 'in_stock';
    wrapper.vm.filters.sortBy = 'stock';
    wrapper.vm.filters.sortOrder = 'desc';

    await wrapper.vm.handleModalSuccess();

    expect(mocks.loadProducts).toHaveBeenLastCalledWith(
      {
        page: 2,
        status: 'active',
        search: 'shoe',
        brand: 'KK',
        category: 'Top',
        hasStock: 'in_stock',
        sortBy: 'stock',
        sortOrder: 'desc',
      },
      true
    );
  });

  it('resets to page 1 and reloads when sorting changes', async () => {
    const wrapper = createWrapper();
    wrapper.vm.filters.search = 'shoe';
    wrapper.vm.filters.brand = 'KK';
    mocks.pagination.page = 3;

    await wrapper.vm.handleSortChange({ sortBy: 'price', sortOrder: 'asc' });

    expect(wrapper.vm.filters.sortBy).toBe('price');
    expect(wrapper.vm.filters.sortOrder).toBe('asc');
    expect(mocks.loadProducts).toHaveBeenLastCalledWith(
      {
        page: 1,
        search: 'shoe',
        brand: 'KK',
        sortBy: 'price',
        sortOrder: 'asc',
      },
      false
    );
  });

  it('uses server-provided filter metadata instead of current page items', () => {
    mocks.availableFilters.value = {
      brands: ['KK', 'ACME'],
      categories: ['Top', 'Shoes'],
    };
    mocks.products.value = [
      { id: 'p-1', brand: 'OnlyCurrentPageBrand', category: 'OnlyCurrentPageCategory' },
    ];

    const wrapper = createWrapper();

    expect(wrapper.vm.brandOptions).toEqual(['KK', 'ACME']);
    expect(wrapper.vm.categoryOptions).toEqual(['Top', 'Shoes']);
    expect(wrapper.vm.brandOptions).not.toEqual(['OnlyCurrentPageBrand']);
    expect(wrapper.vm.categoryOptions).not.toEqual(['OnlyCurrentPageCategory']);
  });
});
