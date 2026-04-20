import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderCreateModal from '@/components/OrderCreateModal.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('OrderCreateModal contract', () => {
  it('renders admin OrderForm without a top-level binding section', () => {
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
          OrderForm: {
            props: ['mode'],
            template: '<div data-testid="order-form-mode">{{ mode }}</div>',
          },
        },
      },
    });

    expect(wrapper.get('[data-testid="order-form-mode"]').text()).toBe('admin');
    expect(wrapper.html()).not.toContain('variant-policy');
  });

  it('passes only creatable admin statuses to OrderForm', () => {
    const wrapper = mount(OrderCreateModal, {
      props: {
        modelValue: true,
        salespersons: [],
        statuses: ['pending', 'confirmed', 'production', 'shipping', 'arrived', 'fulfilled', 'void'],
      },
      global: {
        stubs: {
          Modal: {
            template: '<div><slot /></div>',
          },
          OrderForm: {
            props: ['statuses'],
            template: '<div data-testid="status-options">{{ JSON.stringify(statuses) }}</div>',
          },
        },
      },
    });

    expect(wrapper.get('[data-testid="status-options"]').text()).toBe(
      JSON.stringify(['pending', 'confirmed', 'void'])
    );
  });
});
