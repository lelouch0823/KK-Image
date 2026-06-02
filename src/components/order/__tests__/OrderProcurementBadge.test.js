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
      props: { status: 'ordered', preset: 'detail' },
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

  it('supports a lightweight meta appearance for dense lists', () => {
    const wrapper = mount(OrderProcurementBadge, {
      props: { status: 'partially_received', preset: 'meta' },
    });

    expect(wrapper.text()).toContain('order.procurementStatuses.partially_received');
    expect(wrapper.classes()).toContain('whitespace-nowrap');
    expect(wrapper.find('span > span').exists()).toBe(true);
  });

  it('supports a compact line preset for readonly line-level states', () => {
    const wrapper = mount(OrderProcurementBadge, {
      props: { status: 'ordered', preset: 'line' },
    });

    expect(wrapper.text()).toContain('order.procurementStatuses.ordered');
    expect(wrapper.classes()).toContain('whitespace-nowrap');
    expect(wrapper.classes()).toContain('!text-xs');
  });
});
