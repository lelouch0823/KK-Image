import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { ref } from 'vue';
import SalesSpaceDetailView from '../SalesSpaceDetailView.vue';

const mocks = vi.hoisted(() => ({
  requestSales: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      token: 'sales-token-a',
      id: 'space-1',
    },
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('@/composables/useRequestAdapters', () => ({
  useRequestAdapters: () => ({
    requestSales: mocks.requestSales,
  }),
}));

describe('SalesSpaceDetailView contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads detail through the authenticated sales space api', async () => {
    mocks.requestSales.mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          id: 'space-1',
          name: '销售商品空间',
          template: 'product',
          template_data: '{}',
          files: [],
        },
      }),
    });

    shallowMount(SalesSpaceDetailView, {
      global: {
        provide: {
          salesContext: {
            accessToken: ref('sales-token-a'),
          },
        },
      },
    });

    await flushPromises();

    expect(mocks.requestSales).toHaveBeenCalledWith('/api/sales/sales-token-a/spaces/space-1', {
      token: 'sales-token-a',
    });
  });
});
