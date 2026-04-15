import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderFormFields from '@/components/order/OrderFormFields.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('OrderFormFields status defaults', () => {
  it('exposes only canonical admin order statuses by default', () => {
    const wrapper = mount(OrderFormFields, {
      props: {
        modelValue: {
          status: 'fulfilled',
          name: 'Chair',
          brand: '',
          series: '',
          sku: '',
          quantity: 1,
          size: '',
          color: '',
          material: '',
          remark: '',
          deadline: '',
          salespersonId: '',
        },
        showStatus: true,
      },
      global: {
        stubs: {
          AppInput: true,
          Select: true,
          StatusSelector: {
            props: ['options'],
            template: '<div data-testid="status-options">{{ JSON.stringify(options) }}</div>',
          },
        },
      },
    });

    const statusOptions = wrapper.get('[data-testid="status-options"]').text();
    expect(statusOptions).toContain('arrived');
    expect(statusOptions).toContain('fulfilled');
    expect(statusOptions).not.toContain('delivered');
    expect(statusOptions).not.toContain('completed');
  });
});
