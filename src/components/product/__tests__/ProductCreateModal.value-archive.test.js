import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductCreateModal from '../ProductCreateModal.vue';

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  addVariantImage: vi.fn(),
  sortVariantImages: vi.fn(),
  setVariantPrimaryImage: vi.fn(),
  removeVariantImage: vi.fn(),
  archiveDimension: vi.fn(),
  previewDimensionImpact: vi.fn(),
  addDimensionValue: vi.fn(),
  archiveDimensionValue: vi.fn(),
  restoreDimensionValue: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    createProduct: mocks.createProduct,
    updateProduct: mocks.updateProduct,
    addVariantImage: mocks.addVariantImage,
    sortVariantImages: mocks.sortVariantImages,
    setVariantPrimaryImage: mocks.setVariantPrimaryImage,
    removeVariantImage: mocks.removeVariantImage,
    archiveDimension: mocks.archiveDimension,
    previewDimensionImpact: mocks.previewDimensionImpact,
    addDimensionValue: mocks.addDimensionValue,
    archiveDimensionValue: mocks.archiveDimensionValue,
    restoreDimensionValue: mocks.restoreDimensionValue,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

describe('ProductCreateModal value archive wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.previewDimensionImpact.mockResolvedValue({
      success: true,
      data: {
        affectedVariantsCount: 2,
        sampleVariants: [{ id: 'v1', sku: 'SKU-1', options_values: { Color: 'Red' } }],
      },
    });
    mocks.addDimensionValue.mockResolvedValue({
      success: true,
      data: { id: 'val-blue', value: 'Blue', status: 'active' },
    });
    mocks.archiveDimensionValue.mockResolvedValue({ success: true });
    mocks.restoreDimensionValue.mockResolvedValue({ success: true });
  });

  const createWrapper = () =>
    mount(ProductCreateModal, {
      props: {
        modelValue: true,
        editMode: true,
        initialData: {
          id: 'prod-1',
          dimensions: [
            {
              id: 'dim-color',
              name: 'Color',
              values: [{ id: 'val-red', value: 'Red', status: 'active' }],
            },
          ],
        },
      },
      global: {
        stubs: {
          Teleport: true,
          ImageUploader: true,
          AppInput: true,
          AppButton: true,
          Select: true,
          VariantImageManagerModal: true,
          VariantBatchBuilderModal: true,
        },
      },
    });

  it('opens value archive wizard and archives on confirm', async () => {
    const wrapper = createWrapper();
    const opt = { id: 'dim-color', name: 'Color', values: ['Red'], inputValue: '' };
    wrapper.vm.form.options = [opt];
    wrapper.vm.form.variants = [{ options_values: { 'dim-color': 'Red' } }];

    await wrapper.vm.removeOptionValue(opt, 0);
    expect(wrapper.find('[data-testid="value-archive-modal"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('SKU-1');
    await wrapper.find('[data-testid="value-archive-confirm"]').trigger('click');

    expect(mocks.archiveDimensionValue).toHaveBeenCalledWith('prod-1', 'val-red');
    expect(wrapper.vm.form.options[0].values).toEqual([]);
  });

  it('restores archived value via restore action', async () => {
    const wrapper = createWrapper();
    const opt = {
      id: 'dim-color',
      name: 'Color',
      values: [],
      archivedValues: [{ id: 'val-red', value: 'Red', status: 'archived' }],
      inputValue: '',
    };
    wrapper.vm.form.options = [opt];
    wrapper.vm.form.variants = [];
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="restore-value-0-0"]').trigger('click');

    expect(mocks.restoreDimensionValue).toHaveBeenCalledWith('prod-1', 'val-red');
    expect(wrapper.vm.form.options[0].values).toContain('Red');
    expect(wrapper.vm.form.options[0].archivedValues).toEqual([]);
  });

  it('tracks server-assigned ids for values added during edit mode', async () => {
    const wrapper = createWrapper();
    const opt = { id: 'dim-color', name: 'Color', values: [], inputValue: 'Blue', inputMeta: '' };
    wrapper.vm.form.options = [opt];
    wrapper.vm.form.variants = [];

    await wrapper.vm.addOptionValue(opt);
    await wrapper.vm.removeOptionValue(opt, 0);

    expect(mocks.previewDimensionImpact).toHaveBeenCalledWith('prod-1', {
      action: 'archive_value',
      valueId: 'val-blue',
    });
  });

  it('does not keep a local value when addDimensionValue rejects', async () => {
    mocks.addDimensionValue.mockRejectedValueOnce(new Error('add failed'));

    const wrapper = createWrapper();
    const opt = { id: 'dim-color', name: 'Color', values: [], inputValue: 'Blue', metaMap: {} };
    wrapper.vm.form.options = [opt];
    wrapper.vm.form.variants = [];

    await expect(wrapper.vm.addOptionValue(opt)).resolves.toBeUndefined();

    expect(wrapper.vm.form.options[0].values).toEqual([]);
    expect(wrapper.vm.form.variants).toEqual([]);
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'add failed',
      })
    );
  });

  it('shows an error toast when value impact preview rejects', async () => {
    mocks.previewDimensionImpact.mockRejectedValueOnce(new Error('impact failed'));

    const wrapper = createWrapper();
    const opt = { id: 'dim-color', name: 'Color', values: ['Red'], inputValue: '' };
    wrapper.vm.form.options = [opt];

    await expect(wrapper.vm.removeOptionValue(opt, 0)).resolves.toBeUndefined();

    expect(wrapper.vm.form.options[0].values).toEqual(['Red']);
    expect(wrapper.vm.valueArchiveWizard.open).toBe(false);
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'impact failed',
      })
    );
  });

  it('does not restore an archived value when restore request rejects', async () => {
    mocks.restoreDimensionValue.mockRejectedValueOnce(new Error('restore failed'));

    const wrapper = createWrapper();
    const opt = {
      id: 'dim-color',
      name: 'Color',
      values: [],
      archivedValues: [{ id: 'val-red', value: 'Red', status: 'archived' }],
      inputValue: '',
    };
    wrapper.vm.form.options = [opt];

    await expect(
      wrapper.vm.restoreOptionValue(opt, opt.archivedValues[0], 0)
    ).resolves.toBeUndefined();

    expect(wrapper.vm.form.options[0].values).toEqual([]);
    expect(wrapper.vm.form.options[0].archivedValues).toEqual([
      { id: 'val-red', value: 'Red', status: 'archived' },
    ]);
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'restore failed',
      })
    );
  });

  it('keeps the value archive wizard open and clears loading when archiving rejects', async () => {
    mocks.archiveDimensionValue.mockRejectedValueOnce(new Error('archive failed'));

    const wrapper = createWrapper();
    const opt = { id: 'dim-color', name: 'Color', values: ['Red'], inputValue: '' };
    wrapper.vm.form.options = [opt];
    wrapper.vm.form.variants = [{ options_values: { 'dim-color': 'Red' } }];

    await wrapper.vm.removeOptionValue(opt, 0);
    await expect(
      wrapper.find('[data-testid="value-archive-confirm"]').trigger('click')
    ).resolves.toBeUndefined();

    expect(wrapper.vm.valueArchiveWizard.open).toBe(true);
    expect(wrapper.vm.valueArchiveWizard.loading).toBe(false);
    expect(wrapper.vm.form.options[0].values).toEqual(['Red']);
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'archive failed',
      })
    );
  });
});
