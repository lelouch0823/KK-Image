import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SpaceDocument from '../SpaceDocument.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => {
      const messages = {
        'spacePublic.files': 'files',
        'spacePublic.openPreview': 'Open',
        'spacePublic.download': 'Download',
        'spacePublic.fileReady': 'Ready',
        'spacePublic.noContent': 'No content',
        'spacePublic.unnamedFile': 'Unnamed file',
      };
      return messages[key] || key;
    },
  }),
}));

describe('SpaceDocument', () => {
  it('renders document-oriented file list content', () => {
    const wrapper = mount(SpaceDocument, {
      props: {
        space: {
          id: 'space-doc',
          name: '文档空间',
          description: '用于合同与报价单共享',
          files: [
            {
              id: 'file-1',
              name: '报价单.pdf',
              url: '/file/file-1',
              mimeType: 'application/pdf',
            },
          ],
        },
      },
      global: {
        stubs: {
          AppIcon: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="space-document-template"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('文档空间');
    expect(wrapper.text()).toContain('报价单.pdf');
  });
});
