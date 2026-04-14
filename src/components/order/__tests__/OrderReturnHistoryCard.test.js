import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderReturnHistoryCard from '@/components/order/OrderReturnHistoryCard.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_key, fallback) => fallback || _key }),
}));

describe('OrderReturnHistoryCard', () => {
  it('renders return reason, quantity, and note entries', () => {
    const wrapper = mount(OrderReturnHistoryCard, {
      props: {
        returns: [
          {
            id: 'ret-1',
            status: 'restocked',
            reason: 'damage',
            note: 'outer box collapsed',
            quantity: 1,
            createdBy: 'Admin',
            lineLabel: 'Chair A',
            createdAt: 1710000000000,
          },
        ],
      },
      global: {
        stubs: {
          AppIcon: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Return History');
    expect(wrapper.text()).toContain('Chair A');
    expect(wrapper.text()).toContain('damage');
    expect(wrapper.text()).toContain('outer box collapsed');
    expect(wrapper.text()).toContain('1');
  });
});
