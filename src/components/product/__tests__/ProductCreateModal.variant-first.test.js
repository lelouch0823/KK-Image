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

describe('ProductCreateModal variant-first payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createProduct.mockResolvedValue(true);
  });

  const createWrapper = () =>
    mount(ProductCreateModal, {
      props: { modelValue: true, editMode: false, initialData: {} },
      global: {
        stubs: {
          Teleport: true,
          ImageUploader: true,
          AppInput: true,
          AppButton: true,
          Select: true,
          VariantImageManagerModal: true,
        },
      },
    });

  it('should block submit when variants are empty', async () => {
    const wrapper = createWrapper();
    wrapper.vm.form.name = 'No Variant Product';
    wrapper.vm.form.variants = [];

    await wrapper.vm.handleSubmit();

    expect(mocks.createProduct).not.toHaveBeenCalled();
    expect(mocks.addToast).toHaveBeenCalled();
  });

  it('should submit variant-first payload without product-level business fields', async () => {
    const wrapper = createWrapper();
    wrapper.vm.form.name = 'Variant Product';
    wrapper.vm.form.spu = 'SPU-001';
    wrapper.vm.form.options = [
      { id: 'dim-color', name: 'Color', values: ['Blue'], inputValue: '' },
      { id: 'dim-size', name: 'Size', values: ['L'], inputValue: '' },
    ];
    wrapper.vm.form.variants = [
      {
        sku: 'SKU-001',
        price: 100,
        cost_price: 70,
        stock_quantity: 8,
        alert_threshold: 2,
        status: 'active',
        options_values: { Color: 'Blue', Size: 'L' },
      },
    ];

    await wrapper.vm.handleSubmit();

    expect(mocks.createProduct).toHaveBeenCalledTimes(1);
    const payload = mocks.createProduct.mock.calls[0][0];
    expect(payload.variants).toHaveLength(1);
    expect(payload.dimensions).toEqual([
      { id: 'dim-color', name: 'Color', values: [{ value: 'Blue', meta: undefined }] },
      { id: 'dim-size', name: 'Size', values: [{ value: 'L', meta: undefined }] },
    ]);
    expect(payload).not.toHaveProperty('price');
    expect(payload).not.toHaveProperty('cost_price');
    expect(payload).not.toHaveProperty('stock_quantity');
    expect(payload).not.toHaveProperty('alert_threshold');
    expect(payload).not.toHaveProperty('status');
  });

  it('fills form when edit data arrives after modal is already open', async () => {
    const wrapper = createWrapper();

    await wrapper.setProps({
      modelValue: true,
      editMode: true,
      initialData: {
        id: 'p-late',
        name: 'Late Product',
        currency: 'CNY',
        variants: [],
      },
    });

    expect(wrapper.vm.form.name).toBe('Late Product');
  });

  it('discards pending submit result after modal closes and switches product', async () => {
    let resolveUpdate;
    mocks.updateProduct.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const wrapper = mount(ProductCreateModal, {
      props: {
        modelValue: true,
        editMode: true,
        initialData: {
          id: 'prod-1',
          name: 'Product A',
          currency: 'CNY',
          variants: [],
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
        },
      },
    });

    wrapper.vm.form.name = 'Product A';
    wrapper.vm.form.options = [
      { id: 'dim-color', name: 'Color', values: ['Blue'], inputValue: '' },
    ];
    wrapper.vm.form.variants = [
      {
        id: 'variant-a',
        sku: 'SKU-A',
        price: 100,
        cost_price: 60,
        stock_quantity: 5,
        alert_threshold: 1,
        status: 'active',
        options_values: { Color: 'Blue' },
      },
    ];

    const pending = wrapper.vm.handleSubmit();
    await Promise.resolve();

    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({
      modelValue: true,
      initialData: {
        id: 'prod-2',
        name: 'Product B',
        currency: 'CNY',
        variants: [],
      },
    });

    resolveUpdate({ success: true, data: { id: 'prod-1' } });
    await pending;

    expect(wrapper.emitted('success')).toBeUndefined();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('shows an error toast and keeps the modal open when submit rejects', async () => {
    mocks.createProduct.mockRejectedValueOnce(new Error('network down'));

    const wrapper = createWrapper();
    wrapper.vm.form.name = 'Variant Product';
    wrapper.vm.form.options = [
      { id: 'dim-color', name: 'Color', values: ['Blue'], inputValue: '' },
    ];
    wrapper.vm.form.variants = [
      {
        sku: 'SKU-001',
        price: 100,
        cost_price: 70,
        stock_quantity: 8,
        alert_threshold: 2,
        status: 'active',
        options_values: { Color: 'Blue' },
      },
    ];

    await expect(wrapper.vm.handleSubmit()).resolves.toBeUndefined();

    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'network down',
      })
    );
    expect(wrapper.emitted('success')).toBeUndefined();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.vm.submitting).toBe(false);
  });

  it('blocks submit when edit initialization failed', async () => {
    const wrapper = mount(ProductCreateModal, {
      props: {
        modelValue: true,
        editMode: true,
        initializationError: 'load failed',
        initialData: {
          id: 'prod-1',
          name: 'Broken Product',
          currency: 'CNY',
          variants: [],
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
        },
      },
    });

    wrapper.vm.form.name = 'Broken Product';
    wrapper.vm.form.options = [
      { id: 'dim-color', name: 'Color', values: ['Blue'], inputValue: '' },
    ];
    wrapper.vm.form.variants = [
      {
        id: 'variant-1',
        sku: 'SKU-1',
        price: 100,
        cost_price: 70,
        stock_quantity: 8,
        alert_threshold: 2,
        status: 'active',
        options_values: { Color: 'Blue' },
      },
    ];

    await wrapper.vm.handleSubmit();

    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });
});
