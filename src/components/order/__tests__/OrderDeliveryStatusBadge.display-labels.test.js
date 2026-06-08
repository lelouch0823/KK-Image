import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderDeliveryStatusBadge from '../OrderDeliveryStatusBadge.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

describe('OrderDeliveryStatusBadge display labels', () => {
  it('renders unknown delivery status as a readable label instead of an i18n key', () => {
    const wrapper = mount(OrderDeliveryStatusBadge, {
      props: {
        status: 'carrier_exception',
      },
      global: {
        stubs: {
          StatusBadge: { template: '<span><slot /></span>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Carrier Exception');
    expect(wrapper.text()).not.toContain('order.deliveryStatuses.carrier_exception');
    expect(wrapper.text()).not.toContain('carrier_exception');
  });
});
