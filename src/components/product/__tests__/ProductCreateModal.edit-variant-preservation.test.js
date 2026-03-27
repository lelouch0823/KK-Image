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
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

describe('ProductCreateModal edit variant preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateProduct.mockResolvedValue(true);
  });

  it('keeps the original variant and adds a new combination when specs expand in edit mode', async () => {
    const wrapper = mount(ProductCreateModal, {
      props: {
        modelValue: true,
        editMode: true,
        initialData: {
          id: 'prod-1',
          name: 'Demo',
          currency: 'CNY',
          dimensions: [
            {
              id: 'dim-color',
              name: 'Color',
              values: [{ id: 'val-black', value: 'Black', status: 'active' }],
            },
          ],
          variants: [
            {
              id: 'variant-black',
              sku: 'BLACK-ONLY',
              price: 100,
              cost_price: 60,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
              options_values: { Color: 'Black' },
              images: [],
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

    wrapper.vm.form.options = [
      { id: 'dim-color', name: 'Color', values: ['Black'], inputValue: '' },
      { id: 'dim-size', name: 'Size', values: ['L'], inputValue: '' },
    ];
    wrapper.vm.form.variants = [
      {
        id: 'variant-black',
        _clientKey: 'variant-black',
        sku: 'BLACK-ONLY',
        price: 100,
        cost_price: 60,
        stock_quantity: 5,
        alert_threshold: 1,
        status: 'active',
        options_values: { Color: 'Black' },
        images: [],
      },
    ];

    wrapper.vm.generateVariants();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.form.variants).toHaveLength(2);
    expect(wrapper.vm.form.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'variant-black',
          sku: 'BLACK-ONLY',
          status: 'pending_incomplete',
          options_values: { Color: 'Black' },
        }),
        expect.objectContaining({
          sku: '',
          options_values: { Color: 'Black', Size: 'L' },
        }),
      ])
    );
    expect(wrapper.vm.incompleteVariantCount).toBe(1);
    expect(wrapper.text()).toContain('There are 1 legacy variants that no longer match the current specs. Remove/archive them before saving.');
  });

  it('blocks save until incomplete legacy variants are removed', async () => {
    const wrapper = mount(ProductCreateModal, {
      props: {
        modelValue: true,
        editMode: true,
        initialData: {
          id: 'prod-1',
          name: 'Demo',
          currency: 'CNY',
          dimensions: [
            {
              id: 'dim-color',
              name: 'Color',
              values: [{ id: 'val-black', value: 'Black', status: 'active' }],
            },
          ],
          variants: [
            {
              id: 'variant-black',
              sku: 'BLACK-ONLY',
              price: 100,
              cost_price: 60,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
              options_values: { Color: 'Black' },
              images: [],
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

    wrapper.vm.form.name = 'Demo';
    wrapper.vm.form.options = [
      { id: 'dim-color', name: 'Color', values: ['Black'], inputValue: '' },
      { id: 'dim-size', name: 'Size', values: ['L'], inputValue: '' },
    ];
    wrapper.vm.form.variants = [
      {
        id: 'variant-black',
        _clientKey: 'variant-black',
        sku: 'BLACK-ONLY',
        price: 100,
        cost_price: 60,
        stock_quantity: 5,
        alert_threshold: 1,
        status: 'active',
        options_values: { Color: 'Black' },
        images: [],
      },
    ];

    wrapper.vm.generateVariants();
    wrapper.vm.form.variants[1].sku = 'BLACK-L';
    await wrapper.vm.handleSubmit();

    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Remove or archive incomplete legacy variants before saving',
      })
    );
  });

  it('hydrates persisted dimension-id variants without marking them incomplete', async () => {
    const wrapper = mount(ProductCreateModal, {
      props: {
        modelValue: true,
        editMode: true,
        initialData: {
          id: 'prod-1',
          name: 'Demo',
          currency: 'CNY',
          dimensions: [
            {
              id: 'dim-color',
              name: 'Color',
              values: [{ id: 'val-black', value: 'Black', status: 'active' }],
            },
          ],
          variants: [
            {
              id: 'variant-black',
              sku: 'BLACK-ONLY',
              price: 100,
              cost_price: 60,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
              options_values: { 'dim-color': 'Black' },
              images: [],
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

    expect(wrapper.vm.incompleteVariantCount).toBe(0);
    expect(wrapper.text()).not.toContain('legacy variants');

    wrapper.vm.generateVariants();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.form.variants).toHaveLength(1);
    expect(wrapper.vm.form.variants[0]).toEqual(
      expect.objectContaining({
        id: 'variant-black',
        status: 'active',
        options_values: { Color: 'Black' },
      })
    );
  });
});
