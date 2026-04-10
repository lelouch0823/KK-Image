import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import SalesSpacesView from '../SalesSpacesView.vue';

const mocks = vi.hoisted(() => ({
  requestSales: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
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
});
