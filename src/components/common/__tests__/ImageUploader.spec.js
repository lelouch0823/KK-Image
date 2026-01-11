import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ImageUploader from '../ImageUploader.vue';

// Mock dependencies
vi.mock('@/composables/useI18n', () => ({
    useI18n: () => ({
        t: (key) => key,
    }),
}));

vi.mock('@/composables/useToast', () => ({
    useToast: () => ({
        addToast: vi.fn(),
    }),
}));

vi.mock('@/composables/useDragSort', () => ({
    useDragSort: () => ({
        getDragClass: () => '',
        handleDragStart: vi.fn(),
        handleDragEnd: vi.fn(),
        handleDragOver: vi.fn(),
        handleDragLeave: vi.fn(),
        handleDrop: vi.fn(),
        handleTouchStart: vi.fn(),
        handleTouchMove: vi.fn(),
        handleTouchEnd: vi.fn(),
    }),
}));

vi.mock('@/composables/useImageCompression', () => ({
    useImageCompression: () => ({
        compressImage: vi.fn(),
        getFileHash: vi.fn(),
    }),
}));

describe('ImageUploader.vue', () => {
    it('renders correctly', () => {
        const wrapper = mount(ImageUploader, {
            props: {
                modelValue: [],
                label: 'Test Label',
            },
        });
        expect(wrapper.text()).toContain('Test Label');
    });

    it('renders readonly state', () => {
        const wrapper = mount(ImageUploader, {
            props: {
                modelValue: [],
                readonly: true,
            },
        });
        // Upload button should validly not exist in readonly mode
        expect(wrapper.find('input[type="file"]').exists()).toBe(false);
    });
});
