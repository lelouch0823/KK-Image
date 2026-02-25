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
    useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

describe('ProductCreateModal inline variant image controls', () => {
    const initialData = {
        id: 'prod_1',
        name: 'Test Product',
        sku: 'SKU-1',
        variants: [
            {
                id: 'v1',
                sku: 'SKU-1-RED',
                price: 10,
                stock_quantity: 1,
                options_values: { Color: 'Red' },
                images: [
                    { image_id: 'img-1', is_primary: 1 },
                    { image_id: 'img-2', is_primary: 0 },
                ],
            },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.addVariantImage.mockResolvedValue({ success: true });
        mocks.setVariantPrimaryImage.mockResolvedValue({ success: true });
        mocks.removeVariantImage.mockResolvedValue({ success: true });
    });

    const createWrapper = () =>
        mount(ProductCreateModal, {
            props: {
                modelValue: true,
                editMode: true,
                initialData,
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

    it('supports row-level upload', async () => {
        const wrapper = createWrapper();

        await wrapper.find('[data-testid="variant-row-upload-input-0"]').setValue('img-3');
        await wrapper.find('[data-testid="variant-row-upload-btn-0"]').trigger('click');

        expect(mocks.addVariantImage).toHaveBeenCalledWith('prod_1', 'v1', { imageId: 'img-3' });
    });

    it('supports row-level set-primary', async () => {
        const wrapper = createWrapper();

        await wrapper.find('[data-testid="variant-row-set-primary-0-img-2"]').trigger('click');

        expect(mocks.setVariantPrimaryImage).toHaveBeenCalledWith('prod_1', 'v1', 'img-2');
    });

    it('supports row-level remove image', async () => {
        const wrapper = createWrapper();

        await wrapper.find('[data-testid="variant-row-remove-image-0-img-2"]').trigger('click');

        expect(mocks.removeVariantImage).toHaveBeenCalledWith('prod_1', 'v1', 'img-2');
    });
});
