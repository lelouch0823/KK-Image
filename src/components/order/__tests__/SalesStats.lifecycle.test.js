import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import SalesStats from '@/components/order/SalesStats.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('SalesStats lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the latest token stats when earlier requests resolve late', async () => {
    const resolvers = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          })
      )
    );

    const wrapper = mount(SalesStats, {
      props: { token: 'sales-token-a' },
    });

    await wrapper.setProps({ token: 'sales-token-b' });

    resolvers[1]({
      json: async () => ({
        success: true,
        data: {
          totalOrders: 22,
          completedOrders: 11,
          monthOrders: 7,
          monthlyTrend: [],
        },
      }),
    });
    await flushPromises();

    expect(wrapper.text()).toContain('22');
    expect(wrapper.text()).toContain('11');
    expect(wrapper.text()).toContain('7');

    resolvers[0]({
      json: async () => ({
        success: true,
        data: {
          totalOrders: 5,
          completedOrders: 2,
          monthOrders: 1,
          monthlyTrend: [],
        },
      }),
    });
    await flushPromises();

    expect(wrapper.text()).toContain('22');
    expect(wrapper.text()).not.toContain('5');
  });
});
