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

describe('ProductCreateModal external codes', () => {
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

  it('generateVariants should initialize barcode and supplier_sku fields', async () => {
    const wrapper = createWrapper();
    wrapper.vm.form.options = [{ name: 'Color', values: ['Yellow'], inputValue: '' }];

    wrapper.vm.generateVariants();

    expect(wrapper.vm.form.variants).toHaveLength(1);
    expect(wrapper.vm.form.variants[0].sku).toBe('');
    expect(wrapper.vm.form.variants[0]).toHaveProperty('barcode', '');
    expect(wrapper.vm.form.variants[0]).toHaveProperty('supplier_sku', '');
  });

  it('submit should include barcode and supplier_sku in variant payload', async () => {
    const wrapper = createWrapper();
    wrapper.vm.form.name = 'Variant Product';
    wrapper.vm.form.variants = [
      {
        sku: 'SKU-001',
        price: 100,
        cost_price: 70,
        stock_quantity: 8,
        alert_threshold: 2,
        status: 'active',
        options_values: { Color: 'Blue', Size: 'L' },
        barcode: '6901234567890',
        supplier_sku: 'SUP-BLUE-L',
      },
    ];

    await wrapper.vm.handleSubmit();

    const payload = mocks.createProduct.mock.calls[0][0];
    expect(payload.variants[0].barcode).toBe('6901234567890');
    expect(payload.variants[0].supplier_sku).toBe('SUP-BLUE-L');
  });

  it('blocks submit when a variant sku is empty', async () => {
    const wrapper = createWrapper();
    wrapper.vm.form.name = 'Variant Product';
    wrapper.vm.form.variants = [
      {
        sku: '',
        price: 100,
        cost_price: 70,
        stock_quantity: 8,
        alert_threshold: 2,
        status: 'active',
        options_values: { Color: 'Blue', Size: 'L' },
        barcode: '',
        supplier_sku: '',
      },
    ];

    await wrapper.vm.handleSubmit();

    expect(mocks.createProduct).not.toHaveBeenCalled();
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Please complete each variant SKU/price/cost/inventory/alert/status',
      })
    );
  });
});
