import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ImageUploader from '../ImageUploader.vue';

const mockAuthFetch = vi.fn();
const mockRequestAuth = vi.fn();

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

vi.mock('@/composables/useAuth', () => ({
    useAuth: () => ({
        authFetch: mockAuthFetch,
    }),
}));

vi.mock('@/composables/useRequestAdapters', () => ({
    useRequestAdapters: () => ({
        requestAuth: mockRequestAuth,
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

    it('uses auth adapter for protected upload path instead of direct authFetch fallback', async () => {
        mockAuthFetch.mockReset().mockRejectedValue(new Error('direct fetch forbidden'));
        mockRequestAuth.mockReset().mockResolvedValue({
            json: async () => ({
                success: true,
                data: { id: 'file-1', storage_key: 'key-1' },
            }),
        });

        const wrapper = mount(ImageUploader, {
            props: {
                modelValue: [{
                    id: 'local-1',
                    isLocal: true,
                    file: new File(['binary'], 'demo.jpg', { type: 'image/jpeg' }),
                    hash: 'hash-1',
                    url: 'local://demo.jpg',
                }],
                uploadEndpoint: '/api/manage/upload',
            },
        });

        await expect(wrapper.vm.uploadPendingFiles()).resolves.toBe(true);
        expect(mockRequestAuth).toHaveBeenCalled();
        expect(mockAuthFetch).not.toHaveBeenCalled();
    });
});
