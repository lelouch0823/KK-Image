import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductCreateModal from '../ProductCreateModal.vue';

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  createProductWithMeta: vi.fn(),
  updateProductWithMeta: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    createProduct: mocks.createProduct,
    updateProduct: mocks.updateProduct,
    createProductWithMeta: mocks.createProductWithMeta,
    updateProductWithMeta: mocks.updateProductWithMeta,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

describe('ProductCreateModal inventory ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createProductWithMeta.mockResolvedValue({ success: true });
    mocks.updateProductWithMeta.mockResolvedValue({ success: true });
  });

  const mountModal = (props) =>
    mount(ProductCreateModal, {
      props,
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

  it('keeps existing variant stock read-only in edit mode and omits it from the submitted payload', async () => {
    const wrapper = mountModal({
      modelValue: true,
      editMode: true,
      initialData: {
        id: 'prod-1',
        name: 'Catalog Tee',
        variants: [
          {
            id: 'variant-existing',
            sku: 'SKU-EXISTING',
            price: 100,
            cost_price: 60,
            stock_quantity: 25,
            alert_threshold: 2,
            status: 'active',
            options_values: { Color: 'Red' },
            images: [],
          },
        ],
      },
    });

    await wrapper.vm.handleSubmit();

    expect(mocks.updateProductWithMeta).toHaveBeenCalledTimes(1);
    const [, payload] = mocks.updateProductWithMeta.mock.calls[0];
    expect(payload.variants).toEqual([
      expect.not.objectContaining({
        stock_quantity: expect.anything(),
      }),
    ]);
  });

  it('preserves initial stock submission for new variants in create mode', async () => {
    const wrapper = mountModal({
      modelValue: true,
      editMode: false,
      initialData: {},
    });

    wrapper.vm.form.name = 'New Tee';
    wrapper.vm.form.variants = [
      {
        _clientKey: 'variant-local',
        sku: 'SKU-NEW',
        price: 100,
        cost_price: 60,
        stock_quantity: 8,
        alert_threshold: 2,
        status: 'active',
        options_values: { Color: 'Blue' },
        images: [],
      },
    ];

    await wrapper.vm.handleSubmit();

    expect(mocks.createProductWithMeta).toHaveBeenCalledTimes(1);
    const [payload] = mocks.createProductWithMeta.mock.calls[0];
    expect(payload.variants).toEqual([
      expect.objectContaining({
        stock_quantity: 8,
      }),
    ]);
  });
});
