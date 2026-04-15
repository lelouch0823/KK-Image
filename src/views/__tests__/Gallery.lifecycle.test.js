import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { flushPromises, shallowMount } from '@vue/test-utils';

import GalleryView from '../Gallery.vue';

const route = reactive({
  params: {
    token: 'gallery-token',
  },
});

vi.mock('vue-router', () => ({
  useRoute: () => route,
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object') return key;
      return key;
    },
  }),
}));

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copy: vi.fn(async () => undefined),
  }),
}));

describe('Gallery view lifecycle', () => {
  const mountedWrappers = [];

  beforeEach(() => {
    route.params.token = 'gallery-token';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount();
    }
  });

  const mountGalleryView = () => {
    const wrapper = shallowMount(GalleryView, {
      global: {
        stubs: {
          PasswordGate: true,
          EmptyState: true,
          Lightbox: true,
          AppButton: true,
          AppIcon: true,
          AppImage: true,
          PublicViewerShell: true,
        },
      },
    });
    mountedWrappers.push(wrapper);
    return wrapper;
  };

  it('submits protected gallery passwords via POST and loads the returned album', async () => {
    const fetchMock = vi.fn((url, options) => {
      if (url === '/api/gallery/gallery-token' && (!options || options.method === undefined)) {
        return Promise.resolve({
          json: async () => ({
            success: true,
            data: { requiresPassword: true },
          }),
        });
      }

      if (url === '/api/gallery/gallery-token' && options?.method === 'POST') {
        return Promise.resolve({
          json: async () => ({
            success: true,
            data: {
              name: 'Gallery',
              description: '',
              fileCount: 1,
              files: [
                {
                  id: 'file-1',
                  name: 'hero.jpg',
                  url: '/file/file-1?access=signed',
                },
              ],
            },
          }),
        });
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountGalleryView();
    await flushPromises();

    expect(wrapper.vm.requiresPassword).toBe(true);

    await wrapper.vm.submitPassword('secret');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/gallery/gallery-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    });
    expect(wrapper.vm.requiresPassword).toBe(false);
    expect(wrapper.vm.album).toEqual(
      expect.objectContaining({
        name: 'Gallery',
        fileCount: 1,
      })
    );
  });
});
