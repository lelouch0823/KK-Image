import { describe, it, expect, vi } from 'vitest';
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

vi.mock('@/composables/useI18n', () => ({
    useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

describe('VariantImageManagerModal', () => {
    it('renders variant list and image uploader', () => {
        const wrapper = mount(VariantImageManagerModal, {
            props: {
                modelValue: true,
                variants: baseVariants,
            },
            global: {
                stubs: { Teleport: true, ImageUploader: true },
            },
        });

        expect(wrapper.find('[data-testid="variant-list"]').exists()).toBe(true);
        expect(wrapper.text()).toContain('SKU-RED-S');
        expect(wrapper.findComponent({ name: 'ImageUploader' }).exists()).toBe(true);
    });

    it('emits update-images when ImageUploader model updates', async () => {
        const wrapper = mount(VariantImageManagerModal, {
            props: {
                modelValue: true,
                variants: baseVariants,
            },
            global: {
                stubs: { Teleport: true, ImageUploader: true },
            },
        });

        const uploader = wrapper.findComponent({ name: 'ImageUploader' });
        
        // Simulate uploading a new image sequence
        await uploader.vm.$emit('update:modelValue', [
            { id: 'img-1', url: '/file/img-1' },
            { id: 'img-2', url: '/file/img-2' },
            { id: 'img-99', url: '/file/img-99' },
        ]);

        const emits = wrapper.emitted('update-images');
        expect(emits).toBeTruthy();
        expect(emits[0][0]).toEqual({
            variantId: 'v1',
            variantKey: 'v1',
            images: [
                { id: 'img-1', image_id: 'img-1', is_primary: 1, sort_order: 0 },
                { id: 'img-2', image_id: 'img-2', is_primary: 0, sort_order: 1 },
                { id: 'img-99', image_id: 'img-99', is_primary: 0, sort_order: 2 },
            ],
        });
    });

    it('supports variants without id by emitting variantKey', async () => {
        const wrapper = mount(VariantImageManagerModal, {
            props: {
                modelValue: true,
                variants: [
                    {
                        _clientKey: 'local-1',
                        sku: '',
                        options_values: { Color: 'Red' },
                        images: [],
                    },
                ],
            },
            global: {
                stubs: { Teleport: true, ImageUploader: true },
            },
        });

        const uploader = wrapper.findComponent({ name: 'ImageUploader' });
        await uploader.vm.$emit('update:modelValue', [
            { id: 'img-local', url: '/file/img-local' },
        ]);

        const emits = wrapper.emitted('update-images');
        expect(emits).toBeTruthy();
        expect(emits[0][0]).toEqual({
            variantId: null,
            variantKey: 'local-1',
            images: [
                { id: 'img-local', image_id: 'img-local', is_primary: 1, sort_order: 0 },
            ],
        });
    });
});
