import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderStatusHeader from '@/components/order/OrderStatusHeader.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_key, fallback) => fallback || _key }),
}));

vi.mock('@/utils/formatters', () => ({
  formatTime: (value) => `formatted-${value}`,
}));

describe('OrderStatusHeader', () => {
  it('shows a delivery confirmation action when the fulfilled order is still in transit', async () => {
    const wrapper = mount(OrderStatusHeader, {
      props: {
        orderNo: 'SO-1',
        productName: 'Chair',
        status: 'fulfilled',
        procurementStatus: 'completed',
        deliveryStatus: 'in_transit',
        canConfirmDelivery: true,
      },
      global: {
        stubs: {
          StatusBadge: { template: '<div><slot /></div>' },
          AppIcon: true,
          OrderProcurementBadge: true,
          OrderDeliveryStatusBadge: true,
        },
      },
    });

    await wrapper.get('[data-testid="confirm-delivery-button"]').trigger('click');

    expect(wrapper.emitted('confirm-delivery')).toEqual([[]]);
  });

  it('renders delivery confirmation metadata after delivery is confirmed', () => {
    const wrapper = mount(OrderStatusHeader, {
      props: {
        orderNo: 'SO-1',
        productName: 'Chair',
        status: 'fulfilled',
        procurementStatus: 'completed',
        deliveryStatus: 'delivered',
        canConfirmDelivery: false,
        deliveryConfirmedAt: 1710000000000,
        deliveryConfirmedBy: 'Admin',
        deliveryNote: 'signed by receiver',
      },
      global: {
        stubs: {
          StatusBadge: { template: '<div><slot /></div>' },
          AppIcon: true,
          OrderProcurementBadge: true,
          OrderDeliveryStatusBadge: true,
        },
      },
    });

    expect(wrapper.text()).toContain('formatted-1710000000000');
    expect(wrapper.text()).toContain('Admin');
    expect(wrapper.text()).toContain('signed by receiver');
  });

  it('does not render a separate delivered lifecycle step after fulfilled', () => {
    const wrapper = mount(OrderStatusHeader, {
      props: {
        orderNo: 'SO-1',
        productName: 'Chair',
        status: 'fulfilled',
        procurementStatus: 'completed',
        deliveryStatus: 'delivered',
      },
      global: {
        stubs: {
          StatusBadge: { template: '<div><slot /></div>' },
          AppIcon: true,
          OrderProcurementBadge: true,
          OrderDeliveryStatusBadge: true,
        },
      },
    });

    expect(wrapper.text()).toContain('order.statuses.fulfilled');
    expect(wrapper.text()).not.toContain('order.statuses.delivered');
  });
});
