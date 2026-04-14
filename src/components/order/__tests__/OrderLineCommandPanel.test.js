import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderLineCommandPanel from '@/components/order/OrderLineCommandPanel.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_key, fallback) => fallback || _key }),
}));

const line = {
  id: 'line-1',
  variantId: 'var-1',
  orderedQuantity: 8,
  reservedQuantity: 2,
  shippedQuantity: 2,
  cancelledQuantity: 0,
};

describe('OrderLineCommandPanel', () => {
  it('renders reserve, release, ship, and unship actions for non-terminal orders', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        orderStatus: 'shipping',
        line,
      },
    });

    const input = wrapper.get('input[type="number"]');
    await input.setValue('2');
    await wrapper.get('[data-testid="line-command-reserve"]').trigger('click');
    await wrapper.get('[data-testid="line-command-release"]').trigger('click');
    await wrapper.get('[data-testid="line-command-ship"]').trigger('click');
    await wrapper.get('[data-testid="line-command-unship"]').trigger('click');

    expect(wrapper.emitted('command')).toEqual([
      [{ action: 'reserve', lineId: 'line-1', quantity: 2 }],
      [{ action: 'release', lineId: 'line-1', quantity: 2 }],
      [{ action: 'ship', lineId: 'line-1', quantity: 2 }],
      [{ action: 'unship', lineId: 'line-1', quantity: 2 }],
    ]);
  });

  it('emits return for fulfilled orders while keeping unship disabled', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        orderStatus: 'fulfilled',
        deliveryStatus: 'delivered',
        line,
      },
    });

    const input = wrapper.get('input[type="number"]');
    await input.setValue('2');

    expect(wrapper.get('[data-testid="line-command-unship"]').attributes('disabled')).toBeDefined();
    await wrapper.get('[data-testid="line-command-return"]').trigger('click');

    expect(wrapper.emitted('command')).toEqual([
      [{ action: 'return', lineId: 'line-1', quantity: 2 }],
    ]);
  });

  it('blocks invalid command quantities and shows inline validation feedback', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        line,
      },
    });

    const input = wrapper.get('input[type="number"]');
    await input.setValue('99');
    await wrapper.get('[data-testid="line-command-reserve"]').trigger('click');

    expect(wrapper.emitted('command')).toBeFalsy();
    expect(wrapper.text()).toContain('超过当前动作允许数量');
  });

  it('uses received quantity as the reserve and ship cap when procurement has only partially arrived', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        line: {
          id: 'line-2',
          variantId: 'var-2',
          orderedQuantity: 8,
          receivedQuantity: 3,
          reservedQuantity: 1,
          shippedQuantity: 0,
          cancelledQuantity: 0,
        },
      },
    });

    const input = wrapper.get('input[type="number"]');
    await input.setValue('4');
    await wrapper.get('[data-testid="line-command-reserve"]').trigger('click');

    expect(wrapper.emitted('command')).toBeFalsy();
    expect(wrapper.text()).toContain('超过当前动作允许数量');
  });

  it('disables fulfillment actions for lines that are not bound to a variant', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        line: {
          id: 'line-unbound',
          variantId: null,
          orderedQuantity: 5,
          receivedQuantity: 3,
          reservedQuantity: 1,
          shippedQuantity: 0,
          cancelledQuantity: 0,
        },
      },
    });

    expect(wrapper.get('[data-testid="line-command-reserve"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="line-command-release"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="line-command-ship"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="line-command-unship"]').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Bind a product variant before using fulfillment actions.');
  });

  it('disables unship when there is no shipped quantity to reverse', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        line: {
          id: 'line-3',
          variantId: 'var-3',
          orderedQuantity: 5,
          receivedQuantity: 5,
          reservedQuantity: 0,
          shippedQuantity: 0,
          cancelledQuantity: 0,
        },
      },
    });

    expect(wrapper.get('[data-testid="line-command-unship"]').attributes('disabled')).toBeDefined();
  });

  it('keeps unship available for fulfilled orders before delivery confirmation', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        orderStatus: 'fulfilled',
        deliveryStatus: 'in_transit',
        line: {
          id: 'line-4',
          variantId: 'var-4',
          orderedQuantity: 5,
          receivedQuantity: 5,
          reservedQuantity: 0,
          shippedQuantity: 2,
          cancelledQuantity: 0,
        },
      },
    });

    expect(wrapper.get('[data-testid="line-command-unship"]').attributes('disabled')).toBeUndefined();
  });

  it('disables unship once delivery has been confirmed', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        orderStatus: 'fulfilled',
        deliveryStatus: 'delivered',
        line: {
          id: 'line-4b',
          variantId: 'var-4',
          orderedQuantity: 5,
          receivedQuantity: 5,
          reservedQuantity: 0,
          shippedQuantity: 2,
          cancelledQuantity: 0,
        },
      },
    });

    expect(wrapper.get('[data-testid="line-command-unship"]').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Delivered orders cannot reverse shipped quantity.');
  });

  it('disables return until the order reaches fulfilled terminal state', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        orderStatus: 'shipping',
        deliveryStatus: 'in_transit',
        line: {
          id: 'line-5',
          variantId: 'var-5',
          orderedQuantity: 5,
          receivedQuantity: 5,
          reservedQuantity: 0,
          shippedQuantity: 2,
          returnedQuantity: 0,
          cancelledQuantity: 0,
        },
      },
    });

    expect(wrapper.get('[data-testid="line-command-return"]').attributes('disabled')).toBeDefined();
  });

  it('disables return until delivery has been confirmed', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        orderStatus: 'fulfilled',
        deliveryStatus: 'in_transit',
        line: {
          id: 'line-5b',
          variantId: 'var-5',
          orderedQuantity: 5,
          receivedQuantity: 5,
          reservedQuantity: 0,
          shippedQuantity: 2,
          returnedQuantity: 0,
          cancelledQuantity: 0,
        },
      },
    });

    expect(wrapper.get('[data-testid="line-command-return"]').attributes('disabled')).toBeDefined();
  });

  it('caps return quantity by shipped minus already returned quantity', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        orderStatus: 'fulfilled',
        deliveryStatus: 'delivered',
        line: {
          id: 'line-6',
          variantId: 'var-6',
          orderedQuantity: 5,
          receivedQuantity: 5,
          reservedQuantity: 0,
          shippedQuantity: 4,
          returnedQuantity: 3,
          cancelledQuantity: 0,
        },
      },
    });

    const input = wrapper.get('input[type="number"]');
    await input.setValue('2');
    await wrapper.get('[data-testid="line-command-return"]').trigger('click');

    expect(wrapper.emitted('command')).toBeFalsy();
    expect(wrapper.text()).toContain('超过当前动作允许数量');
  });
});
