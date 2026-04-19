import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderForm from '@/components/order/OrderForm.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('@/composables/useRecentInputs', () => ({
  useRecentInputs: () => ({
    getRecent: () => [],
    saveMultiple: vi.fn(),
  }),
}));

vi.mock('@/composables/useSalesToken', () => ({
  useSalesToken: () => ({ token: { value: 'sales-token' } }),
}));

const buildWrapper = () =>
  mount(OrderForm, {
    props: {
      mode: 'admin',
      salespersons: [{ id: 'sp-1', name: 'Alice' }],
      statuses: [{ label: '待处理', value: 'pending' }],
      prefill: {
        salespersonId: 'sp-1',
        files: [{ id: 'file-1', url: '/file/file-1' }],
        lines: [
          { name: 'Desk', quantity: 2, sku: 'SKU-DESK' },
          { sku: 'SKU-PENDING', quantity: 3 },
        ],
      },
    },
    global: {
      stubs: {
        ImageUploader: {
          props: ['modelValue'],
          template: '<div data-testid="file-count">{{ modelValue.length }}</div>',
          methods: {
            async uploadPendingFiles() {
              return true;
            },
          },
        },
        AutocompleteInput: {
          props: ['modelValue', 'disabled'],
          template: `
            <input
              :value="modelValue"
              :disabled="disabled"
              @input="$emit('update:modelValue', $event.target.value)"
            />
          `,
        },
        AppInput: {
          props: ['modelValue', 'disabled', 'textarea', 'type'],
          inheritAttrs: false,
          template: `
            <component
              :is="textarea ? 'textarea' : 'input'"
              :value="modelValue"
              :type="type || 'text'"
              :disabled="disabled"
              :data-testid="$attrs['data-testid']"
              @input="$emit('update:modelValue', $event.target.value)"
            />
          `,
        },
        AppButton: {
          template: '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        StatusSelector: {
          props: ['modelValue'],
          template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        Select: {
          props: ['modelValue'],
          template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        AppIcon: true,
        ProductBindingSection: {
          props: ['boundProduct'],
          template: '<div data-testid="binding-panel">{{ boundProduct ? "bound" : "empty" }}</div>',
        },
      },
    },
  });

describe('OrderForm multiline payload', () => {
  it('shows multiline summary, warns about pending rows, and copies a line with quantity reset', async () => {
    const wrapper = buildWrapper();

    expect(wrapper.get('[data-testid="file-count"]').text()).toBe('1');
    expect(wrapper.get('[data-testid="order-lines-summary"]').text()).toContain('2');
    expect(wrapper.get('[data-testid="summary-total-quantity"]').text()).toContain('5');
    expect(wrapper.get('[data-testid="summary-pending-lines"]').text()).toContain('1');

    await wrapper.get('[data-testid="copy-order-line-0"]').trigger('click');
    await wrapper.get('[data-testid="order-line-name-1"]').setValue('Desk Pro');
    await wrapper.get('[data-testid="order-line-name-2"]').setValue('Chair');

    expect(wrapper.findAll('[data-testid^="order-line-name-"]').length).toBeGreaterThanOrEqual(3);
    expect(wrapper.get('[data-testid="order-line-quantity-1"]').element.value).toBe('1');
  });
});
