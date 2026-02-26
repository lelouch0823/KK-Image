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
    }),
}));

vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
    useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

describe('ProductCreateModal dimension archive mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.previewDimensionImpact.mockResolvedValue({
            success: true,
            data: { affectedVariantsCount: 3 },
        });
        mocks.archiveDimension.mockResolvedValue({ success: true });
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

    it('uses merge_keep when user selects merge mode', async () => {
        const wrapper = createWrapper();
        wrapper.vm.form.options = [{ id: 'dim-color', name: 'Color', values: ['Red'], inputValue: '' }];
        wrapper.vm.form.variants = [{ options_values: { 'dim-color': 'Red' } }];

        await wrapper.vm.removeOption(0);
        expect(wrapper.find('[data-testid="dimension-archive-modal"]').exists()).toBe(true);
        await wrapper.find('[data-testid="dimension-archive-next"]').trigger('click');
        wrapper.vm.dimensionArchiveWizard.mode = 'merge_keep';
        await wrapper.find('[data-testid="dimension-archive-confirm"]').trigger('click');

        expect(mocks.archiveDimension).toHaveBeenCalledWith('prod-1', 'dim-color', { mode: 'merge_keep' });
    });

    it('uses archive_variants when user keeps default mode', async () => {
        const wrapper = createWrapper();
        wrapper.vm.form.options = [{ id: 'dim-color', name: 'Color', values: ['Red'], inputValue: '' }];
        wrapper.vm.form.variants = [{ options_values: { 'dim-color': 'Red' } }];

        await wrapper.vm.removeOption(0);
        expect(wrapper.find('[data-testid="dimension-archive-modal"]').exists()).toBe(true);
        await wrapper.find('[data-testid="dimension-archive-next"]').trigger('click');
        await wrapper.find('[data-testid="dimension-archive-confirm"]').trigger('click');

        expect(mocks.archiveDimension).toHaveBeenCalledWith('prod-1', 'dim-color', { mode: 'archive_variants' });
    });
});
