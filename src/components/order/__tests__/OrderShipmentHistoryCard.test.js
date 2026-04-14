import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderShipmentHistoryCard from '@/components/order/OrderShipmentHistoryCard.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallbackOrParams, maybeParams) => {
      const fallback = typeof fallbackOrParams === 'string' ? fallbackOrParams : '';
      const params = typeof fallbackOrParams === 'object' ? fallbackOrParams : maybeParams;
      return fallback.replace('{quantity}', String(params?.quantity ?? ''));
    },
  }),
}));

describe('OrderShipmentHistoryCard', () => {
  it('renders shipment and unshipment rows with line labels and quantities', () => {
    const wrapper = mount(OrderShipmentHistoryCard, {
      props: {
        shipments: [
          {
            id: 'ship-1',
            actionType: 'shipped',
            quantity: 2,
            actorName: 'Admin',
            lineLabel: 'Chair A',
            createdAt: 1710000000000,
          },
          {
            id: 'ship-2',
            actionType: 'unshipped',
            quantity: 1,
            actorName: 'Admin',
            lineLabel: 'Chair A',
            createdAt: 1710003600000,
          },
        ],
      },
      global: {
        stubs: {
          AppIcon: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Shipment History');
    expect(wrapper.text()).toContain('Chair A');
    expect(wrapper.text()).toContain('2');
    expect(wrapper.text()).toContain('1');
    expect(wrapper.text()).toContain('shipped');
    expect(wrapper.text()).toContain('unshipped');
  });
});
