import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import OrderDashboard from '@/components/order/OrderDashboard.vue';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    authFetch: mocks.authFetch,
    currentUser: ref(null),
  }),
}));

describe('OrderDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          todayCount: 4,
          pendingCount: 2,
          weekCount: 9,
          awaitingDeliveryCount: 3,
          deliveredCount: 6,
          partiallyReturnedCount: 1,
          returnedCount: 1,
          statusDistribution: { pending: 2, fulfilled: 4 },
          deliveryStatusDistribution: {
            in_transit: 3,
            delivered: 6,
            partially_returned: 1,
            returned: 1,
          },
        },
      }),
    });
  });

  it('renders post-fulfillment lifecycle tiles and emits filter shortcuts', async () => {
    const wrapper = mount(OrderDashboard, {
      global: {
        stubs: {
          MetricTile: {
            props: ['label', 'value', 'clickable'],
            emits: ['click'],
            template: `
              <button type="button" :data-label="label" @click="$emit('click')">
                <span>{{ label }}</span>
                <span>{{ value }}</span>
                <slot name="value" />
              </button>
            `,
          },
          StatusChartModal: true,
        },
      },
    });

    await vi.waitFor(() => {
      expect(mocks.authFetch).toHaveBeenCalledTimes(1);
    });
    await nextTick();
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('3');
      expect(wrapper.text()).toContain('6');
    });

    expect(wrapper.text()).toContain('order.dashboard.awaitingDelivery');
    expect(wrapper.text()).toContain('order.dashboard.delivered');
    expect(wrapper.text()).toContain('order.dashboard.partiallyReturned');
    expect(wrapper.text()).toContain('order.dashboard.returned');

    await wrapper.get('[data-label="order.dashboard.awaitingDelivery"]').trigger('click');
    await wrapper.get('[data-label="order.dashboard.delivered"]').trigger('click');
    await wrapper.get('[data-label="order.dashboard.partiallyReturned"]').trigger('click');
    await wrapper.get('[data-label="order.dashboard.returned"]').trigger('click');

    expect(wrapper.emitted('filter')).toEqual([
      ['awaiting_delivery'],
      ['delivered'],
      ['partially_returned'],
      ['returned'],
    ]);
  });
});
