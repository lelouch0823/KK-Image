import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderProfitCard from '../OrderProfitCard.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

describe('OrderProfitCard display labels', () => {
  it('renders unknown cost source as a readable label instead of an i18n key', async () => {
    const wrapper = mount(OrderProfitCard, {
      props: {
        profit: {
          revenue: 100,
          cost: 80,
          profit: 20,
          margin: 20,
          costComplete: true,
          lines: [
            {
              orderLineId: 'line-1',
              productName: 'Chair',
              quantity: 1,
              unitPrice: 100,
              unitCost: 80,
              profit: 20,
              margin: 20,
              costSource: 'manual_adjustment',
            },
          ],
        },
      },
      global: {
        stubs: {
          AppButton: {
            emits: ['click'],
            template: '<button @click="$emit(\'click\')"><slot /><slot name="icon-right" /></button>',
          },
          AppIcon: { template: '<i />' },
        },
      },
    });

    await wrapper.get('button').trigger('click');

    expect(wrapper.text()).toContain('Manual Adjustment');
    expect(wrapper.text()).not.toContain('order.profit.costSources.manual_adjustment');
    expect(wrapper.text()).not.toContain('manual_adjustment');
  });
});
