import { describe, it, expect, vi } from 'vitest';
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
});
