import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import OrderLineProcurementState from '@/components/order/OrderLineProcurementState.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

const ProcurementBadgeStub = defineComponent({
  name: 'OrderProcurementBadge',
  props: {
    status: { type: String, default: 'none' },
    compact: { type: Boolean, default: false },
    preset: { type: String, default: '' },
    title: { type: String, default: '' },
  },
  template: '<div data-testid="procurement-badge">{{ status }}</div>',
});

describe('OrderLineProcurementState', () => {
  it('renders a compact, end-aligned procurement badge with normalized title', () => {
    const wrapper = mount(OrderLineProcurementState, {
      props: {
        status: 'unexpected',
      },
      global: {
        stubs: {
          OrderProcurementBadge: ProcurementBadgeStub,
        },
      },
    });

    expect(wrapper.classes()).toContain('justify-end');
    expect(wrapper.classes()).toContain('shrink-0');
    expect(wrapper.classes()).toContain('max-w-[8.5rem]');

    const badge = wrapper.getComponent(ProcurementBadgeStub);
    expect(badge.props('status')).toBe('unexpected');
    expect(badge.props('preset')).toBe('line');
    expect(badge.props('title')).toBe('order.procurementStatuses.none');
  });

  it('supports alternate alignment when needed', () => {
    const wrapper = mount(OrderLineProcurementState, {
      props: {
        status: 'ordered',
        align: 'start',
      },
      global: {
        stubs: {
          OrderProcurementBadge: ProcurementBadgeStub,
        },
      },
    });

    expect(wrapper.classes()).toContain('justify-start');
  });
});
