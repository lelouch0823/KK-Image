import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderProcurementBadge from '@/components/order/OrderProcurementBadge.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('OrderProcurementBadge', () => {
  it('renders fallback none for unknown status', () => {
    const wrapper = mount(OrderProcurementBadge, {
      props: { status: 'unexpected' },
    });

    expect(wrapper.text()).toContain('order.procurementStatuses.none');
  });

  it('renders explicit procurement status label', () => {
    const wrapper = mount(OrderProcurementBadge, {
      props: { status: 'ordered', showLabel: true },
    });

    expect(wrapper.text()).toContain('order.procurementStatus');
    expect(wrapper.text()).toContain('order.procurementStatuses.ordered');
  });

  it('renders line-level display statuses without falling back to none', () => {
    const wrapper = mount(OrderProcurementBadge, {
      props: { status: 'partially_received' },
    });

    expect(wrapper.text()).toContain('order.procurementStatuses.partially_received');
  });
});
