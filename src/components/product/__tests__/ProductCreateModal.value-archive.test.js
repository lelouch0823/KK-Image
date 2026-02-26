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
        mocks.archiveDimensionValue.mockResolvedValue({ success: true });
        mocks.restoreDimensionValue.mockResolvedValue({ success: true });
    });

    const createWrapper = () => mount(ProductCreateModal, {
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
});
