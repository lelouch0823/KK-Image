import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderReturnHistoryCard from '@/components/order/OrderReturnHistoryCard.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallbackOrParams, maybeParams) => {
      const fallback = typeof fallbackOrParams === 'string' ? fallbackOrParams : '';
      const params = typeof fallbackOrParams === 'object' ? fallbackOrParams : maybeParams;
      return fallback
        .replace('{quantity}', String(params?.quantity ?? ''))
        .replace('{status}', String(params?.status ?? ''));
    },
  }),
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
    expect(wrapper.text()).toContain('Damage');
    expect(wrapper.text()).toContain('outer box collapsed');
    expect(wrapper.text()).toContain('1');
  });

  it('renders unknown return reason and status as readable labels instead of raw backend codes', () => {
    const wrapper = mount(OrderReturnHistoryCard, {
      props: {
        returns: [
          {
            id: 'ret-unknown',
            status: 'awaiting_quality_review',
            reason: 'warehouse_damage_report',
            note: '',
            quantity: 2,
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

    expect(wrapper.text()).toContain('Warehouse Damage Report');
    expect(wrapper.text()).toContain('Awaiting Quality Review');
    expect(wrapper.text()).not.toContain('warehouse_damage_report');
    expect(wrapper.text()).not.toContain('awaiting_quality_review');
  });
});
