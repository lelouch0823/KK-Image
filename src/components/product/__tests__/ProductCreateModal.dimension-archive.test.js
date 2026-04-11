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
        mocks.archiveDimension.mockResolvedValue({ success: true, data: { effect: { archivedVariants: 1 } } });
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

    it('removes locally affected variants after archiving a dimension', async () => {
        const wrapper = createWrapper();
        wrapper.vm.form.options = [{ id: 'dim-color', name: 'Color', values: ['Red'], inputValue: '' }];
        wrapper.vm.form.variants = [
            {
                id: 'variant-red',
                sku: 'SKU-RED',
                price: 10,
                cost_price: 6,
                stock_quantity: 5,
                alert_threshold: 1,
                status: 'active',
                options_values: { 'dim-color': 'Red' },
                images: [],
            },
        ];

        await wrapper.vm.removeOption(0);
        await wrapper.find('[data-testid="dimension-archive-next"]').trigger('click');
        await wrapper.find('[data-testid="dimension-archive-confirm"]').trigger('click');

        expect(wrapper.vm.form.variants).toEqual([]);
        expect(wrapper.vm.incompleteVariantCount).toBe(0);
    });

    it('ignores archived dimensions when hydrating edit form', () => {
        const wrapper = mount(ProductCreateModal, {
            props: {
                modelValue: true,
                editMode: true,
                initialData: {
                    id: 'prod-1',
                    dimensions: [
                        {
                            id: 'dim-color',
                            name: 'Color',
                            status: 'active',
                            values: [
                                { id: 'val-red', value: 'Red', status: 'active' },
                                { id: 'val-blue', value: 'Blue', status: 'archived' },
                            ],
                        },
                        {
                            id: 'dim-size',
                            name: 'Size',
                            status: 'archived',
                            values: [{ id: 'val-m', value: 'M', status: 'archived' }],
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

        expect(wrapper.vm.form.options).toEqual([
            expect.objectContaining({
                id: 'dim-color',
                name: 'Color',
                values: ['Red'],
                archivedValues: [{ id: 'val-blue', value: 'Blue', status: 'archived' }],
            }),
        ]);
    });

    it('does not open dimension archive wizard after modal closes during impact preview', async () => {
        let resolveImpact;
        mocks.previewDimensionImpact.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveImpact = resolve;
                })
        );

        const wrapper = createWrapper();
        wrapper.vm.form.options = [{ id: 'dim-color', name: 'Color', values: ['Red'], inputValue: '' }];

        const pending = wrapper.vm.removeOption(0);
        await Promise.resolve();

        await wrapper.setProps({ modelValue: false });
        await wrapper.vm.$nextTick();

        resolveImpact({
            success: true,
            data: { affectedVariantsCount: 3, sampleVariants: [] },
        });
        await pending;

        expect(wrapper.vm.dimensionArchiveWizard.open).toBe(false);
    });

    it('shows an error toast when dimension impact preview rejects', async () => {
        mocks.previewDimensionImpact.mockRejectedValueOnce(new Error('impact failed'));

        const wrapper = createWrapper();
        wrapper.vm.form.options = [{ id: 'dim-color', name: 'Color', values: ['Red'], inputValue: '' }];

        await expect(wrapper.vm.removeOption(0)).resolves.toBeUndefined();

        expect(wrapper.vm.form.options).toHaveLength(1);
        expect(wrapper.vm.dimensionArchiveWizard.open).toBe(false);
        expect(mocks.addToast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                message: 'impact failed',
            })
        );
    });

    it('keeps the wizard open and clears loading when archiving a dimension rejects', async () => {
        mocks.archiveDimension.mockRejectedValueOnce(new Error('archive failed'));

        const wrapper = createWrapper();
        wrapper.vm.form.options = [{ id: 'dim-color', name: 'Color', values: ['Red'], inputValue: '' }];
        wrapper.vm.form.variants = [{ options_values: { 'dim-color': 'Red' } }];

        await wrapper.vm.removeOption(0);
        await wrapper.find('[data-testid="dimension-archive-next"]').trigger('click');

        await expect(wrapper.find('[data-testid="dimension-archive-confirm"]').trigger('click')).resolves.toBeUndefined();

        expect(wrapper.vm.dimensionArchiveWizard.open).toBe(true);
        expect(wrapper.vm.dimensionArchiveWizard.loading).toBe(false);
        expect(wrapper.vm.form.options).toHaveLength(1);
        expect(mocks.addToast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                message: 'archive failed',
            })
        );
    });
});
