import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductCreateModal from '../ProductCreateModal.vue';

const mocks = vi.hoisted(() => ({
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
    useProducts: () => ({
        createProduct: mocks.createProduct,
        updateProduct: mocks.updateProduct,
    }),
}));

vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('@/composables/useI18n', () => ({
    useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

describe('ProductCreateModal variant images integration', () => {
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
                ],
            },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
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

    it('updates variant images when VariantImageManagerModal emits update-images', async () => {
        const wrapper = createWrapper();

        const modal = wrapper.findComponent({ name: 'VariantImageManagerModal' });
        expect(modal.exists()).toBe(true);

        // Emit update-images event
        modal.vm.$emit('update-images', {
            variantId: 'v1',
            images: [
                { image_id: 'img-2', is_primary: 1, sort_order: 0 },
                { image_id: 'img-1', is_primary: 0, sort_order: 1 },
            ],
        });

        // We can't easily assert the internal form data without triggering a submit
        // or checking passed props. Let's trigger a submit to see the updated payload.
        mocks.updateProduct.mockResolvedValue({ success: true });
        
        await wrapper.find('form').trigger('submit.prevent');

        expect(mocks.updateProduct).toHaveBeenCalledWith('prod_1', expect.objectContaining({
            variants: expect.arrayContaining([
                expect.objectContaining({
                    id: 'v1',
                    images: [
                        { image_id: 'img-2', is_primary: 1, sort_order: 0 },
                        { image_id: 'img-1', is_primary: 0, sort_order: 1 },
                    ],
                }),
            ]),
        }));
    });

    it('updates unsaved variant images by variantKey in create mode', async () => {
        const wrapper = mount(ProductCreateModal, {
            props: {
                modelValue: true,
                editMode: true,
                initialData: {
                    ...initialData,
                    variants: [
                        {
                            _clientKey: 'local-1',
                            sku: '',
                            price: 10,
                            cost_price: 5,
                            stock_quantity: 3,
                            alert_threshold: 1,
                            status: 'active',
                            options_values: { Color: 'Red' },
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
                },
            },
        });

        const modal = wrapper.findComponent({ name: 'VariantImageManagerModal' });
        modal.vm.$emit('update-images', {
            variantId: null,
            variantKey: 'local-1',
            images: [{ image_id: 'img-local', is_primary: 1, sort_order: 0 }],
        });

        mocks.updateProduct.mockResolvedValue({ success: true });
        await wrapper.find('form').trigger('submit.prevent');

        expect(mocks.updateProduct).toHaveBeenCalledWith('prod_1', expect.objectContaining({
            variants: expect.arrayContaining([
                expect.objectContaining({
                    images: [{ image_id: 'img-local', is_primary: 1, sort_order: 0 }],
                }),
            ]),
        }));
    });
});
