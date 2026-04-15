import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import FileSelector from '../FileSelector.vue';
import { API } from '@/utils/constants';

const authFetchMock = vi.fn();

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    authFetch: authFetchMock,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

describe('FileSelector authz behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows root files when folders tree is forbidden', async () => {
    const foldersForbidden = new Error('权限不足: folders:read');
    foldersForbidden.status = 403;
    foldersForbidden.data = { error: '权限不足: folders:read' };

    authFetchMock.mockRejectedValueOnce(foldersForbidden).mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: [{ id: 'file-1', name: 'root-file.pdf', url: '/root-file.pdf' }],
        }),
    });

    const wrapper = mount(FileSelector, {
      global: {
        stubs: {
          Modal: {
            template: '<div><slot name="header" /><slot /><slot name="footer" /></div>',
          },
          AppImage: {
            props: ['src', 'alt'],
            template: '<img :src="src" :alt="alt" />',
          },
          AppIcon: true,
        },
      },
    });

    await flushPromises();

    expect(authFetchMock).toHaveBeenNthCalledWith(2, API.FILES);
    expect(wrapper.text()).toContain('root-file.pdf');
  });
});
