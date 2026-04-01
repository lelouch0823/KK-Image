import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import SpaceProductEditor from '../SpaceProductEditor.vue';

const mocks = vi.hoisted(() => ({
  loadSpace: vi.fn(),
  loadProduct: vi.fn(),
  updateSpace: vi.fn(),
  addFilesToSpace: vi.fn(),
  removeFilesFromSpace: vi.fn(),
  reorderSpaceFiles: vi.fn(),
  registerFolderRefresh: vi.fn(),
  unregisterFolderRefresh: vi.fn(),
  addToast: vi.fn(),
  can: vi.fn(),
}));

vi.mock('@/composables/useSpaces', () => ({
  useSpaces: () => ({
    updateSpace: mocks.updateSpace,
    addFilesToSpace: mocks.addFilesToSpace,
    removeFilesFromSpace: mocks.removeFilesFromSpace,
    reorderSpaceFiles: mocks.reorderSpaceFiles,
    loadSpace: mocks.loadSpace,
  }),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    loadProduct: mocks.loadProduct,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast: mocks.addToast,
  }),
}));

vi.mock('@/composables/useAccessControl', () => ({
  useAccessControl: () => ({
    can: mocks.can,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || '',
  }),
}));

vi.mock('@/composables/useUploadQueue', () => ({
  useUploadQueue: () => ({
    addFiles: vi.fn(),
    registerFolderRefresh: mocks.registerFolderRefresh,
    unregisterFolderRefresh: mocks.unregisterFolderRefresh,
  }),
}));

describe('SpaceProductEditor contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockResolvedValue(true);
    mocks.loadSpace.mockResolvedValue({
      id: 'space-1',
      name: 'Space Name',
      description: 'Space Desc',
      isPublic: true,
      shareMode: 'selected',
      sharedSalespersons: [{ id: 'sp-1' }],
      coverFileId: 'cover-1',
      password: '',
      productId: 'prod-1',
      variantId: 'var-2',
      templateData: {
        brand: 'Brand 1',
        series: 'Series 1',
        price: '88',
        material: 'Leather',
        sku: 'SKU-2',
      },
      files: [],
    });
    mocks.loadProduct.mockResolvedValue({
      id: 'prod-1',
      name: 'Product 1',
      brand: 'Brand 1',
      series: 'Series 1',
      images: ['prod-image'],
      variants: [
        { id: 'var-1', sku: 'SKU-1' },
        { id: 'var-2', sku: 'SKU-2' },
      ],
    });
  });

  it('hydrates bound product state from camelCase space detail payload', async () => {
    const wrapper = mount(SpaceProductEditor, {
      props: {
        space: { id: 'space-1', shareToken: 'share-token' },
      },
      global: {
        stubs: {
          FileSelector: { template: '<div />' },
          Tooltip: { template: '<div><slot /></div>' },
          SpaceAnalytics: { template: '<div />' },
          SpaceShareCard: { template: '<div />' },
          SpaceVisibilitySelector: { template: '<div />' },
          SpaceMediaGrid: { template: '<div />' },
          ConfirmDialog: { template: '<div />' },
          ProductBindingSection: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(mocks.loadSpace).toHaveBeenCalledWith('space-1');
    expect(mocks.loadProduct).toHaveBeenCalledWith('prod-1');
    expect(wrapper.vm.form.productId).toBe('prod-1');
    expect(wrapper.vm.form.variantId).toBe('var-2');
    expect(wrapper.vm.boundProduct).toMatchObject({
      id: 'prod-1',
      sku: 'SKU-2',
    });
  });

  it('does not hydrate selected variant from legacy snake_case-only space detail payload', async () => {
    mocks.loadSpace.mockResolvedValueOnce({
      id: 'space-1',
      name: 'Space Name',
      description: 'Space Desc',
      productId: 'prod-1',
      variant_id: 'var-2',
      templateData: {},
      files: [],
    });

    const wrapper = mount(SpaceProductEditor, {
      props: {
        space: { id: 'space-1', shareToken: 'share-token' },
      },
      global: {
        stubs: {
          FileSelector: { template: '<div />' },
          Tooltip: { template: '<div><slot /></div>' },
          SpaceAnalytics: { template: '<div />' },
          SpaceShareCard: { template: '<div />' },
          SpaceVisibilitySelector: { template: '<div />' },
          SpaceMediaGrid: { template: '<div />' },
          ConfirmDialog: { template: '<div />' },
          ProductBindingSection: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.vm.form.variantId).toBe(null);
    expect(wrapper.vm.boundProduct.sku).toBe('');
  });

  it('does not load product details when product manage permission is missing', async () => {
    mocks.can.mockResolvedValueOnce(false);

    const wrapper = mount(SpaceProductEditor, {
      props: {
        space: { id: 'space-1', shareToken: 'share-token' },
      },
      global: {
        stubs: {
          FileSelector: { template: '<div />' },
          Tooltip: { template: '<div><slot /></div>' },
          SpaceAnalytics: { template: '<div />' },
          SpaceShareCard: { template: '<div />' },
          SpaceVisibilitySelector: { template: '<div />' },
          SpaceMediaGrid: { template: '<div />' },
          ConfirmDialog: { template: '<div />' },
          ProductBindingSection: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(mocks.loadSpace).toHaveBeenCalledWith('space-1');
    expect(mocks.loadProduct).not.toHaveBeenCalled();
    expect(wrapper.vm.form.productId).toBe('prod-1');
  });
});
