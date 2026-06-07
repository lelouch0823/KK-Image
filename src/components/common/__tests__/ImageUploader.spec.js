import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ImageUploader from '../ImageUploader.vue';

const mockAuthFetch = vi.fn();
const mockRequestAuth = vi.fn();
const mockAddToast = vi.fn();
const mockCompressImage = vi.fn();
const mockGetFileHash = vi.fn();

// Mock dependencies
vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
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
    compressImage: mockCompressImage,
    getFileHash: mockGetFileHash,
  }),
}));

vi.mock('@/utils/common', () => ({
  generateRandomId: () => 'local-generated-id',
}));

describe('ImageUploader.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createWrapper(props = {}) {
    return mount(ImageUploader, {
      props: {
        modelValue: [],
        uploadEndpoint: '/api/manage/upload',
        ...props,
      },
      global: {
        stubs: {
          UploadPreviewItem: {
            name: 'UploadPreviewItem',
            props: ['file', 'index'],
            template: `
                            <div>
                                <button
                                    :data-testid="'remove-' + index"
                                    @click="$emit('remove')"
                                >
                                    remove
                                </button>
                                <button
                                    :data-testid="'replace-' + index"
                                    @click="$emit('replace', { target: { files: [new File(['next'], 'next.jpg', { type: 'image/jpeg' })], value: 'x' } })"
                                >
                                    replace
                                </button>
                            </div>
                        `,
          },
          UploadButton: {
            name: 'UploadButton',
            template:
              '<button data-testid="upload-button" @click="$emit(\'select\', $attrs.selectEvent)">upload</button>',
          },
          UploadProcessingIndicator: {
            template: '<div data-testid="processing-indicator">processing</div>',
          },
        },
      },
      attrs: {
        selectEvent: null,
      },
    });
  }

  it('renders correctly', () => {
    const wrapper = createWrapper({ label: 'Test Label' });
    expect(wrapper.text()).toContain('Test Label');
  });

  it('renders readonly state', () => {
    const wrapper = createWrapper({ readonly: true });
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

    const wrapper = createWrapper({
      modelValue: [
        {
          id: 'local-1',
          isLocal: true,
          file: new File(['binary'], 'demo.jpg', { type: 'image/jpeg' }),
          hash: 'hash-1',
          url: 'local://demo.jpg',
        },
      ],
    });

    await expect(wrapper.vm.uploadPendingFiles()).resolves.toBe(true);
    expect(mockRequestAuth).toHaveBeenCalled();
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('adds instant-uploaded files when original hash precheck hits', async () => {
    const file = new File(['binary'], 'demo.jpg', { type: 'image/jpeg' });
    mockGetFileHash.mockResolvedValue('original-hash-1');
    mockRequestAuth.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: {
          exists: true,
          file: {
            id: 'file-1',
            url: '/file/existing-key',
          },
        },
      }),
    });

    const wrapper = createWrapper();
    wrapper.findComponent({ name: 'UploadButton' }).vm.$emit('select', {
      target: { files: [file], value: 'picked' },
    });
    await flushPromises();

    expect(mockRequestAuth).toHaveBeenCalledWith(
      '/api/manage/files/check-hash',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(mockCompressImage).not.toHaveBeenCalled();
    expect(wrapper.emitted('update:modelValue')[0][0]).toEqual([
      expect.objectContaining({
        id: 'file-1',
        url: '/file/existing-key',
        originalHash: 'original-hash-1',
        instantUpload: true,
      }),
    ]);
    expect(mockAddToast).toHaveBeenCalledWith({
      message: 'upload.instantUploadSuccess',
      type: 'success',
    });
  });

  it('stores deferred uploads locally after compression when dedupe misses', async () => {
    const file = new File(['binary'], 'demo.jpg', { type: 'image/jpeg' });
    const compressed = new File(['compressed'], 'demo-compressed.jpg', { type: 'image/jpeg' });
    mockGetFileHash.mockResolvedValue('original-hash-2');
    mockRequestAuth.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: { exists: false },
      }),
    });
    mockCompressImage.mockResolvedValue({
      file: compressed,
      hash: 'content-hash-2',
      originalHash: 'original-hash-2',
    });

    const createObjectURL = vi.fn(() => 'blob:local-image');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });

    const wrapper = createWrapper({ deferred: true, context: 'product' });
    wrapper.findComponent({ name: 'UploadButton' }).vm.$emit('select', {
      target: { files: [file], value: 'picked' },
    });
    await flushPromises();

    expect(createObjectURL).toHaveBeenCalledWith(compressed);
    expect(mockRequestAuth).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('update:modelValue')[0][0]).toEqual([
      expect.objectContaining({
        id: 'local-generated-id',
        url: 'blob:local-image',
        file: compressed,
        hash: 'content-hash-2',
        originalHash: 'original-hash-2',
        isLocal: true,
      }),
    ]);
  });

  it('deletes remote files and revokes local blob urls on remove', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL });
    mockRequestAuth.mockResolvedValue({ json: async () => ({ success: true }) });

    const wrapper = createWrapper({
      modelValue: [
        { id: 'file-1', url: '/file/1', isLocal: false },
        { id: 'local-1', url: 'blob:demo', isLocal: true },
      ],
    });

    wrapper.findComponent({ name: 'UploadPreviewItem' }).vm.$emit('remove');
    await flushPromises();
    wrapper.findAllComponents({ name: 'UploadPreviewItem' })[1].vm.$emit('remove');
    await flushPromises();

    expect(mockRequestAuth).toHaveBeenCalledWith('/api/manage/files/file-1', { method: 'DELETE' });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:demo');
    expect(wrapper.emitted('update:modelValue')).toHaveLength(2);
  });

  it('returns false and shows a toast when pending upload fails', async () => {
    mockRequestAuth.mockRejectedValue(new Error('server down'));

    const wrapper = createWrapper({
      modelValue: [
        {
          id: 'local-1',
          isLocal: true,
          file: new File(['binary'], 'demo.jpg', { type: 'image/jpeg' }),
          hash: 'hash-1',
          url: 'blob:demo.jpg',
        },
      ],
    });

    await expect(wrapper.vm.uploadPendingFiles()).resolves.toBe(false);
    expect(mockAddToast).toHaveBeenCalledWith({
      message: 'demo.jpg uploadQueue.uploadFailed',
      type: 'error',
    });
  });
});
