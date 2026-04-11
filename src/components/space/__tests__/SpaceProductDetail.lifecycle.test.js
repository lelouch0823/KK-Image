import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import SpaceProductDetail from '../SpaceProductDetail.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || '',
  }),
}));

vi.mock('@/composables/useBatchDownload', () => ({
  useBatchDownload: () => ({
    downloading: { value: false },
    downloadProgress: { value: 0 },
    downloadAll: vi.fn(),
  }),
}));

describe('SpaceProductDetail lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createSpace = ({ name, images, coverFileId = null }) => ({
    id: `space-${name}`,
    name,
    templateData: {
      images,
    },
    files: [],
    coverFileId,
    viewCount: 0,
    downloadCount: 0,
  });

  it('resets media selection state when switching to another product space', async () => {
    const wrapper = mount(SpaceProductDetail, {
      props: {
        space: createSpace({
          name: '旧空间',
          images: ['old-a.jpg', 'old-b.jpg'],
          coverFileId: 'p-img-1',
        }),
      },
      global: {
        stubs: {
          AppImage: true,
          AppIcon: true,
        },
      },
    });

    wrapper.vm.currentIndex = 1;
    wrapper.vm.showPdfPreview = true;

    await wrapper.setProps({
      space: createSpace({
        name: '新空间',
        images: ['new-cover.jpg', 'new-detail.jpg'],
        coverFileId: 'p-img-0',
      }),
    });

    expect(wrapper.vm.currentIndex).toBe(0);
    expect(wrapper.vm.showPdfPreview).toBe(false);
    expect(wrapper.vm.currentFile).toEqual(
      expect.objectContaining({ url: '/file/new-cover.jpg' })
    );
  });

  it('preserves already resolved template image urls instead of prefixing /file again', () => {
    const wrapper = mount(SpaceProductDetail, {
      props: {
        space: createSpace({
          name: '已解析图片空间',
          images: ['/file/already-resolved.jpg', 'https://cdn.example.com/variant-main.jpg'],
        }),
      },
      global: {
        stubs: {
          AppImage: true,
          AppIcon: true,
        },
      },
    });

    expect(wrapper.vm.displayFiles).toEqual([
      expect.objectContaining({ url: '/file/already-resolved.jpg' }),
      expect.objectContaining({ url: 'https://cdn.example.com/variant-main.jpg' }),
    ]);
  });

  it('deduplicates template images already merged into space files', () => {
    const wrapper = mount(SpaceProductDetail, {
      props: {
        space: {
          id: 'space-dup',
          name: '去重空间',
          templateData: {
            images: ['variant-main.jpg'],
          },
          files: [
            {
              id: 'file-1',
              url: '/file/variant-main.jpg',
              name: 'variant-main.jpg',
              mimeType: 'image/jpeg',
              size: 0,
            },
          ],
          coverFileId: null,
          viewCount: 0,
          downloadCount: 0,
        },
      },
      global: {
        stubs: {
          AppImage: true,
          AppIcon: true,
        },
      },
    });

    expect(wrapper.vm.displayFiles).toHaveLength(1);
    expect(wrapper.vm.displayFiles[0]).toEqual(
      expect.objectContaining({ url: '/file/variant-main.jpg' })
    );
  });

  it('renders without undefined desktop state warnings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mount(SpaceProductDetail, {
      props: {
        space: createSpace({
          name: '警告空间',
          images: ['warn-check.jpg'],
        }),
      },
      global: {
        stubs: {
          AppImage: true,
          AppIcon: true,
        },
      },
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
