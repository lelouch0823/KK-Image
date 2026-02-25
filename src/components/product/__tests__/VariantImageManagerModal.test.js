import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import VariantImageManagerModal from '../VariantImageManagerModal.vue';

const baseVariants = [
    {
        id: 'v1',
        sku: 'SKU-RED-S',
        options_values: { Color: 'Red', Size: 'S' },
        images: [
            { image_id: 'img-1', is_primary: 1 },
            { image_id: 'img-2', is_primary: 0 },
        ],
    },
    {
        id: 'v2',
        sku: 'SKU-BLUE-M',
        options_values: { Color: 'Blue', Size: 'M' },
        images: [{ image_id: 'img-3', is_primary: 1 }],
    },
];

describe('VariantImageManagerModal', () => {
    it('renders variant list and image panel', () => {
        const wrapper = mount(VariantImageManagerModal, {
            props: {
                modelValue: true,
                variants: baseVariants,
            },
            global: {
                stubs: { Teleport: true },
            },
        });

        expect(wrapper.find('[data-testid="variant-list"]').exists()).toBe(true);
        expect(wrapper.text()).toContain('SKU-RED-S');
        expect(wrapper.find('[data-testid="image-panel"]').text()).toContain('img-1');
    });

    it('upload callback updates local list and emits payload', async () => {
        const wrapper = mount(VariantImageManagerModal, {
            props: {
                modelValue: true,
                variants: baseVariants,
            },
            global: {
                stubs: { Teleport: true },
            },
        });

        await wrapper.find('[data-testid="new-image-id"]').setValue('img-99');
        await wrapper.find('[data-testid="add-image"]').trigger('click');

        const uploads = wrapper.emitted('upload-image');
        expect(uploads).toBeTruthy();
        expect(uploads[0][0]).toEqual({ variantId: 'v1', imageId: 'img-99' });
        expect(wrapper.find('[data-testid="image-panel"]').text()).toContain('img-99');
    });

    it('set-primary emits correct payload', async () => {
        const wrapper = mount(VariantImageManagerModal, {
            props: {
                modelValue: true,
                variants: baseVariants,
            },
            global: {
                stubs: { Teleport: true },
            },
        });

        await wrapper.find('[data-testid="set-primary-img-2"]').trigger('click');
        const emitted = wrapper.emitted('set-primary');
        expect(emitted).toBeTruthy();
        expect(emitted[0][0]).toEqual({ variantId: 'v1', imageId: 'img-2' });
    });

    it('drag-sort action emits sorted output', async () => {
        const wrapper = mount(VariantImageManagerModal, {
            props: {
                modelValue: true,
                variants: baseVariants,
            },
            global: {
                stubs: { Teleport: true },
            },
        });

        await wrapper.find('[data-testid="move-up-img-2"]').trigger('click');
        const emitted = wrapper.emitted('sort-images');
        expect(emitted).toBeTruthy();
        expect(emitted[0][0]).toEqual({
            variantId: 'v1',
            imageIds: ['img-2', 'img-1'],
        });
    });
});
