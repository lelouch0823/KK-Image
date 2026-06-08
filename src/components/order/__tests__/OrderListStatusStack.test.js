import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import OrderListStatusStack from '@/components/order/OrderListStatusStack.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

const StatusChangerStub = defineComponent({
  name: 'OrderStatusChanger',
  props: {
    status: { type: String, required: true },
    loading: { type: Boolean, default: false },
    permissions: { type: Array, default: () => [] },
    showChevron: { type: Boolean, default: true },
    canDeliver: { type: Boolean, default: true },
    onStatusChange: { type: Function, default: null },
  },
  template: '<div data-testid="status-changer">{{ status }}</div>',
});

const ProcurementBadgeStub = defineComponent({
  name: 'OrderProcurementBadge',
  props: {
    status: { type: String, default: 'none' },
    appearance: { type: String, default: 'badge' },
    compact: { type: Boolean, default: false },
    preset: { type: String, default: '' },
  },
  template: '<div data-testid="procurement-badge">{{ status }}</div>',
});

const DeliveryBadgeStub = defineComponent({
  name: 'OrderDeliveryStatusBadge',
  props: {
    status: { type: String, default: 'not_shipped' },
    preset: { type: String, default: '' },
  },
  template: '<div data-testid="delivery-badge">{{ status }}</div>',
});

const StatusPillStub = defineComponent({
  name: 'AppTableStatusPill',
  props: {
    variant: { type: String, default: 'default' },
    label: { type: String, default: '' },
    title: { type: String, default: '' },
  },
  template: '<div data-testid="status-badge">{{ label }}</div>',
});

describe('OrderListStatusStack', () => {
  it('uses the dense centered stack contract and forwards props to child components', () => {
    const onStatusChange = vi.fn();
    const wrapper = mount(OrderListStatusStack, {
      props: {
        status: 'confirmed',
        procurementStatus: 'partially_received',
        deliveryStatus: 'in_transit',
        loading: true,
        permissions: ['orders:manage'],
        canDeliver: false,
        mode: 'manage',
        onStatusChange,
      },
      global: {
        stubs: {
          OrderStatusChanger: StatusChangerStub,
          OrderProcurementBadge: ProcurementBadgeStub,
          OrderDeliveryStatusBadge: DeliveryBadgeStub,
          AppTableStatusPill: StatusPillStub,
        },
      },
    });

    expect(wrapper.classes()).toContain('items-center');
    expect(wrapper.classes()).toContain('text-center');

    const statusChanger = wrapper.getComponent(StatusChangerStub);
    expect(statusChanger.props('status')).toBe('confirmed');
    expect(statusChanger.props('loading')).toBe(true);
    expect(statusChanger.props('permissions')).toEqual(['orders:manage']);
    expect(statusChanger.props('showChevron')).toBe(false);
    expect(statusChanger.props('canDeliver')).toBe(false);
    expect(statusChanger.props('onStatusChange')).toBe(onStatusChange);

    const procurementBadge = wrapper.getComponent(ProcurementBadgeStub);
    expect(procurementBadge.props('status')).toBe('partially_received');
    expect(procurementBadge.props('preset')).toBe('meta');

    const deliveryBadge = wrapper.getComponent(DeliveryBadgeStub);
    expect(deliveryBadge.props('status')).toBe('in_transit');
    expect(deliveryBadge.props('preset')).toBe('meta');
  });

  it('renders a readonly end-aligned stack for passive list cards', () => {
    const wrapper = mount(OrderListStatusStack, {
      props: {
        status: 'pending',
        procurementStatus: 'ordered',
        deliveryStatus: 'not_shipped',
        mode: 'list',
      },
      global: {
        stubs: {
          OrderStatusChanger: StatusChangerStub,
          OrderProcurementBadge: ProcurementBadgeStub,
          OrderDeliveryStatusBadge: DeliveryBadgeStub,
          AppTableStatusPill: StatusPillStub,
        },
      },
    });

    expect(wrapper.classes()).toContain('items-end');
    expect(wrapper.classes()).toContain('text-right');
    expect(wrapper.findComponent(StatusChangerStub).exists()).toBe(false);

    const statusBadge = wrapper.getComponent(StatusPillStub);
    expect(statusBadge.props('variant')).toBe('warning');
    expect(statusBadge.props('title')).toBe('Pending');
    expect(wrapper.get('[data-testid="status-badge"]').text()).toContain('Pending');

    const procurementBadge = wrapper.getComponent(ProcurementBadgeStub);
    expect(procurementBadge.props('preset')).toBe('line');
    expect(wrapper.findComponent(DeliveryBadgeStub).exists()).toBe(false);
  });

  it('renders unknown readonly order status as a readable label', () => {
    const wrapper = mount(OrderListStatusStack, {
      props: {
        status: 'manual_review_required',
        procurementStatus: 'none',
        deliveryStatus: 'not_shipped',
        mode: 'list',
      },
      global: {
        stubs: {
          OrderStatusChanger: StatusChangerStub,
          OrderProcurementBadge: ProcurementBadgeStub,
          OrderDeliveryStatusBadge: DeliveryBadgeStub,
          AppTableStatusPill: StatusPillStub,
        },
      },
    });

    const statusBadge = wrapper.getComponent(StatusPillStub);
    expect(statusBadge.props('title')).toBe('Manual Review Required');
    expect(wrapper.get('[data-testid="status-badge"]').text()).toContain('Manual Review Required');
    expect(wrapper.text()).not.toContain('order.statuses.manual_review_required');
    expect(wrapper.text()).not.toContain('manual_review_required');
  });
});
