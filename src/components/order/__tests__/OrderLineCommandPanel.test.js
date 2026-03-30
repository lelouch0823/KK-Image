import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderLineCommandPanel from '@/components/order/OrderLineCommandPanel.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_key, fallback) => fallback || _key }),
}));

const line = {
  id: 'line-1',
  orderedQuantity: 8,
  reservedQuantity: 2,
  shippedQuantity: 1,
  cancelledQuantity: 0,
};

describe('OrderLineCommandPanel', () => {
  it('renders reserve, release, and ship actions and emits the selected command with quantity', async () => {
    const wrapper = mount(OrderLineCommandPanel, {
      props: {
        line,
      },
    });

    const input = wrapper.get('input[type="number"]');
    await input.setValue('2');
    await wrapper.get('[data-testid="line-command-reserve"]').trigger('click');
    await wrapper.get('[data-testid="line-command-release"]').trigger('click');
    await wrapper.get('[data-testid="line-command-ship"]').trigger('click');

    expect(wrapper.emitted('command')).toEqual([
      [{ action: 'reserve', lineId: 'line-1', quantity: 2 }],
      [{ action: 'release', lineId: 'line-1', quantity: 2 }],
      [{ action: 'ship', lineId: 'line-1', quantity: 2 }],
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
});
