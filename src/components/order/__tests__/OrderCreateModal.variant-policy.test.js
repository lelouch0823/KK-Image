import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderCreateModal from '@/components/OrderCreateModal.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('OrderCreateModal variant policy', () => {
  it('always uses allow_out_of_stock policy for preorder entry', () => {
    const wrapper = mount(OrderCreateModal, {
      props: {
        modelValue: true,
        salespersons: [],
        statuses: [],
      },
      global: {
        stubs: {
          Modal: {
            template: '<div><slot /></div>',
          },
          ProductBindingSection: {
            props: ['variantSelectPolicy'],
            template: '<div data-testid="variant-policy">{{ variantSelectPolicy }}</div>',
          },
          OrderForm: true,
        },
      },
    });

    expect(wrapper.get('[data-testid="variant-policy"]').text()).toBe('allow_out_of_stock');
  });
});
