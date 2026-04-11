import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import SalesSpacesView from '../SalesSpacesView.vue';

const mocks = vi.hoisted(() => ({
  requestSales: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, params) => {
      if (key === 'salesSpaces.fileCount') {
        return `${key}:${params?.count ?? ''}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/composables/useRequestAdapters', () => ({
  useRequestAdapters: () => ({
    requestSales: mocks.requestSales,
  }),
}));

describe('SalesSpacesView lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the latest token spaces when earlier requests resolve late', async () => {
    const resolvers = [];
    mocks.requestSales.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );

    const accessToken = ref('sales-token-a');
    const wrapper = mount(SalesSpacesView, {
      global: {
        provide: {
          salesContext: {
            accessToken,
          },
        },
        stubs: {
          AppImage: true,
        },
      },
    });

    accessToken.value = 'sales-token-b';
    await flushPromises();

    expect(mocks.requestSales).toHaveBeenCalledTimes(2);

    resolvers[1]({
      json: async () => ({
        success: true,
        data: [{ id: 'space-b', name: 'Space B', share_token: 'share-b' }],
      }),
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Space B');

    resolvers[0]({
      json: async () => ({
        success: true,
        data: [{ id: 'space-a', name: 'Space A', share_token: 'share-a' }],
      }),
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Space B');
    expect(wrapper.text()).not.toContain('Space A');
  });

  it('hydrates product template images into cover and file count when list payload has no bound files', async () => {
    mocks.requestSales.mockResolvedValue({
      json: async () => ({
        success: true,
        data: [
          {
            id: 'space-product-1',
            name: '新品空间',
            template: 'product',
            share_token: 'share-product-1',
            file_count: 0,
            template_data: JSON.stringify({
              images: ['variant-main.jpg', '/file/product-side.jpg'],
            }),
          },
        ],
      }),
    });

    const wrapper = mount(SalesSpacesView, {
      global: {
        provide: {
          salesContext: {
            accessToken: ref('sales-token-a'),
          },
        },
        stubs: {
          AppImage: {
            props: ['src'],
            template: '<img data-testid="space-cover" :src="src" />',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-testid="space-cover"]').attributes('src')).toBe('/file/variant-main.jpg');
    expect(wrapper.get('a').attributes('href')).toBe('/sales/sales-token-a/spaces/space-product-1');
    expect(wrapper.text()).toContain('salesSpaces.fileCount:2');
  });

  it('routes sales spaces to the authenticated sales detail view instead of the public share page', async () => {
    mocks.requestSales.mockResolvedValue({
      json: async () => ({
        success: true,
        data: [
          {
            id: 'space-private-1',
            name: '私有空间',
            template: 'product',
            share_token: 'share-private-1',
            is_public: 0,
          },
        ],
      }),
    });

    const wrapper = mount(SalesSpacesView, {
      global: {
        provide: {
          salesContext: {
            accessToken: ref('sales-token-a'),
          },
        },
        stubs: {
          AppImage: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('a').attributes('href')).toBe('/sales/sales-token-a/spaces/space-private-1');
  });
});
