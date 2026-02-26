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

    const createWrapper = () => mount(ProductCreateModal, {
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
        wrapper.vm.form.variants = [{
            sku: 'SKU-001',
            price: 100,
            cost_price: 70,
            stock_quantity: 8,
            alert_threshold: 2,
            status: 'active',
            options_values: { Color: 'Blue', Size: 'L' },
        }];

        await wrapper.vm.handleSubmit();

        expect(mocks.createProduct).toHaveBeenCalledTimes(1);
        const payload = mocks.createProduct.mock.calls[0][0];
        expect(payload.variants).toHaveLength(1);
        expect(payload.dimensions).toEqual([
            { id: 'dim-color', name: 'Color', values: ['Blue'] },
            { id: 'dim-size', name: 'Size', values: ['L'] },
        ]);
        expect(payload).not.toHaveProperty('price');
        expect(payload).not.toHaveProperty('cost_price');
        expect(payload).not.toHaveProperty('stock_quantity');
        expect(payload).not.toHaveProperty('alert_threshold');
        expect(payload).not.toHaveProperty('status');
    });
});
