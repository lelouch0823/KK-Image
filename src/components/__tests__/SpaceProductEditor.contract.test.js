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
    document.body.innerHTML = '';
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

  it('keeps a fallback bound product card when historical binding target has already disappeared', async () => {
    mocks.loadSpace.mockResolvedValueOnce({
      id: 'space-1',
      name: 'Space Name',
      description: 'Space Desc',
      productId: 'prod-1',
      variantId: 'var-2',
      bindingState: 'missing_variant',
      templateData: {
        brand: 'Brand 1',
        series: 'Series 1',
        price: '88',
        material: 'Leather',
        sku: 'SKU-2',
        images: ['snapshot-image'],
      },
      files: [],
    });
    mocks.loadProduct.mockResolvedValueOnce(null);

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

    expect(wrapper.vm.boundProduct).toMatchObject({
      id: 'prod-1',
      variantId: 'var-2',
      name: 'Brand 1 Series 1',
      sku: 'SKU-2',
    });
    expect(document.body.textContent || '').toContain('历史快照');
  });

  it('prefers snapshot binding card when the bound variant is archived but product still loads', async () => {
    mocks.loadSpace.mockResolvedValueOnce({
      id: 'space-1',
      name: 'Space Name',
      description: 'Space Desc',
      productId: 'prod-1',
      variantId: 'var-2',
      bindingState: 'archived_variant',
      templateData: {
        brand: 'Snapshot Brand',
        series: 'Snapshot Series',
        price: '88',
        material: 'Leather',
        sku: 'SNAP-SKU',
        images: ['snapshot-image'],
      },
      files: [],
    });
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'prod-1',
      name: 'Live Product',
      brand: 'Live Brand',
      series: 'Live Series',
      images: ['live-image'],
      variants: [
        { id: 'var-2', sku: 'LIVE-SKU', status: 'archived' },
      ],
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

    expect(wrapper.vm.boundProduct).toMatchObject({
      id: 'prod-1',
      name: 'Snapshot Brand Snapshot Series',
      sku: 'SNAP-SKU',
      mainImage: '/file/snapshot-image',
    });
    expect(document.body.textContent || '').toContain('规格已归档');
  });

  it('keeps core product fields readonly when a bound product exists without product permission', async () => {
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

    const lockedValues = ['Brand 1', 'Series 1', '88', 'Leather', 'SKU-2'];
    const lockedInputs = Array.from(document.body.querySelectorAll('input')).filter((input) =>
      lockedValues.includes(input.value)
    );

    expect(wrapper.vm.form.productId).toBe('prod-1');
    expect(lockedInputs).toHaveLength(5);
    lockedInputs.forEach((input) => {
      expect(input.disabled).toBe(true);
    });
  });

  it('prefers selected variant material when rebinding a product space', async () => {
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

    wrapper.vm.handleProductSelect({
      id: 'prod-1',
      name: 'Product 1',
      brand: 'Brand 1',
      series: 'Series 1',
      images: ['prod-image'],
      specifications: { material: 'Cotton' },
      selectedVariant: {
        id: 'var-2',
        sku: 'SKU-2',
        price: 88,
        options_values: { 材质: 'Leather' },
      },
    });

    expect(wrapper.vm.form.templateData.material).toBe('Leather');
  });

  it('keeps the latest initData result when refreshes race', async () => {
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
    vi.clearAllMocks();

    let resolveSpaceFirst;
    let resolveSpaceSecond;

    mocks.can.mockResolvedValue(true);
    mocks.loadSpace
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSpaceFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSpaceSecond = resolve;
          })
      );
    mocks.loadProduct.mockImplementation(async (productId) => ({
      id: productId,
      name: productId === 'prod-2' ? 'Second Product' : 'Stale Product',
      brand: productId === 'prod-2' ? 'Brand 2' : 'Brand 1',
      series: productId === 'prod-2' ? 'Series 2' : 'Series 1',
      images: [productId === 'prod-2' ? 'img-2' : 'img-1'],
      variants: [{ id: productId === 'prod-2' ? 'var-2' : 'var-1', sku: productId === 'prod-2' ? 'SKU-2' : 'SKU-1' }],
    }));

    const first = wrapper.vm.initData();
    await Promise.resolve();
    const second = wrapper.vm.initData();
    await Promise.resolve();

    resolveSpaceSecond({
      id: 'space-1',
      name: 'Second Space',
      description: 'Second Desc',
      isPublic: true,
      shareMode: 'selected',
      sharedSalespersons: [],
      productId: 'prod-2',
      variantId: 'var-2',
      templateData: {},
      files: [],
    });
    await second;

    resolveSpaceFirst({
      id: 'space-1',
      name: 'First Space',
      description: 'First Desc',
      isPublic: false,
      shareMode: 'none',
      sharedSalespersons: [],
      productId: 'prod-1',
      variantId: 'var-1',
      templateData: {},
      files: [],
    });
    await first;

    expect(wrapper.vm.form.name).toBe('Second Space');
    expect(wrapper.vm.boundProduct).toMatchObject({
      id: 'prod-2',
      name: 'Second Product',
      sku: 'SKU-2',
    });
  });

  it('reloads editor state and refresh binding when switching to another space id', async () => {
    mocks.loadSpace
      .mockResolvedValueOnce({
        id: 'space-1',
        name: 'First Space',
        description: 'First Desc',
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
        files: [{ id: 'file-1' }],
      })
      .mockResolvedValueOnce({
        id: 'space-2',
        name: 'Second Space',
        description: 'Second Desc',
        isPublic: false,
        shareMode: 'none',
        sharedSalespersons: [],
        coverFileId: 'cover-2',
        password: '',
        productId: 'prod-2',
        variantId: 'var-9',
        templateData: {
          brand: 'Brand 2',
          series: 'Series 2',
          price: '188',
          material: 'Wood',
          sku: 'SKU-9',
        },
        files: [{ id: 'file-9' }],
      });
    mocks.loadProduct
      .mockResolvedValueOnce({
        id: 'prod-1',
        name: 'Product 1',
        brand: 'Brand 1',
        series: 'Series 1',
        images: ['prod-image-1'],
        variants: [
          { id: 'var-2', sku: 'SKU-2' },
        ],
      })
      .mockResolvedValueOnce({
        id: 'prod-2',
        name: 'Product 2',
        brand: 'Brand 2',
        series: 'Series 2',
        images: ['prod-image-2'],
        variants: [
          { id: 'var-9', sku: 'SKU-9' },
        ],
      });

    const wrapper = mount(SpaceProductEditor, {
      props: {
        space: { id: 'space-1', shareToken: 'share-token-1' },
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
    expect(wrapper.vm.form.name).toBe('First Space');
    expect(mocks.registerFolderRefresh).toHaveBeenCalledWith('space_space-1', expect.any(Function));

    await wrapper.setProps({
      space: { id: 'space-2', shareToken: 'share-token-2' },
    });
    await flushPromises();

    expect(mocks.unregisterFolderRefresh).toHaveBeenCalledWith('space_space-1');
    expect(mocks.registerFolderRefresh).toHaveBeenLastCalledWith('space_space-2', expect.any(Function));
    expect(mocks.loadSpace).toHaveBeenLastCalledWith('space-2');
    expect(mocks.loadProduct).toHaveBeenLastCalledWith('prod-2');
    expect(wrapper.vm.form.name).toBe('Second Space');
    expect(wrapper.vm.form.productId).toBe('prod-2');
    expect(wrapper.vm.boundProduct).toMatchObject({
      id: 'prod-2',
      sku: 'SKU-9',
    });
    expect(wrapper.vm.files).toEqual([{ id: 'file-9' }]);
  });

  it('does not refresh or emit updated when adding files fails', async () => {
    mocks.addFilesToSpace.mockResolvedValueOnce(false);

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
    vi.clearAllMocks();
    mocks.addFilesToSpace.mockResolvedValueOnce(false);

    await wrapper.vm.addFiles(['file-1']);

    expect(mocks.addFilesToSpace).toHaveBeenCalledWith('space-1', ['file-1']);
    expect(mocks.loadSpace).not.toHaveBeenCalled();
    expect(wrapper.emitted('updated')).toBeUndefined();
  });

  it('keeps remove confirmation open when removing files fails', async () => {
    mocks.removeFilesFromSpace.mockResolvedValueOnce(false);

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
    vi.clearAllMocks();
    mocks.removeFilesFromSpace.mockResolvedValueOnce(false);

    wrapper.vm.removeFile('file-1');
    await wrapper.vm.confirmData.onConfirm();

    expect(mocks.removeFilesFromSpace).toHaveBeenCalledWith('space-1', ['file-1']);
    expect(mocks.loadSpace).not.toHaveBeenCalled();
    expect(wrapper.emitted('updated')).toBeUndefined();
    expect(wrapper.vm.confirmData.show).toBe(true);
  });

  it('preserves unsaved form edits when files are added successfully', async () => {
    mocks.loadSpace
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        id: 'space-1',
        name: 'Server Name',
        description: 'Server Desc',
        isPublic: true,
        shareMode: 'selected',
        sharedSalespersons: [{ id: 'sp-1' }],
        coverFileId: 'cover-2',
        password: '',
        productId: 'prod-1',
        variantId: 'var-2',
        templateData: {
          brand: 'Server Brand',
          series: 'Server Series',
          price: '99',
          material: 'Wood',
          sku: 'SERVER-SKU',
        },
        files: [{ id: 'file-1' }],
      });
    mocks.addFilesToSpace.mockResolvedValueOnce(true);

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
    wrapper.vm.form.name = 'Draft Name';
    wrapper.vm.form.description = 'Draft Desc';

    await wrapper.vm.addFiles(['file-1']);

    expect(wrapper.vm.form.name).toBe('Draft Name');
    expect(wrapper.vm.form.description).toBe('Draft Desc');
    expect(wrapper.vm.files).toEqual([{ id: 'file-1' }]);
    expect(wrapper.vm.form.coverFileId).toBe('cover-2');
  });

  it('preserves unsaved form edits when upload refresh callbacks reload media', async () => {
    mocks.loadSpace
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        id: 'space-1',
        name: 'Server Name',
        description: 'Server Desc',
        isPublic: true,
        shareMode: 'selected',
        sharedSalespersons: [{ id: 'sp-1' }],
        coverFileId: 'cover-2',
        password: '',
        productId: 'prod-1',
        variantId: 'var-2',
        templateData: {
          brand: 'Server Brand',
          series: 'Server Series',
          price: '99',
          material: 'Wood',
          sku: 'SERVER-SKU',
        },
        files: [{ id: 'file-2' }],
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
    wrapper.vm.form.name = 'Draft Name';
    wrapper.vm.form.description = 'Draft Desc';

    const refreshMedia = mocks.registerFolderRefresh.mock.calls[0][1];
    await refreshMedia();
    await flushPromises();

    expect(wrapper.vm.form.name).toBe('Draft Name');
    expect(wrapper.vm.form.description).toBe('Draft Desc');
    expect(wrapper.vm.files).toEqual([{ id: 'file-2' }]);
    expect(wrapper.vm.form.coverFileId).toBe('cover-2');
  });
});
