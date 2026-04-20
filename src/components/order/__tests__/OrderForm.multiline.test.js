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

const defaultProps = {
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
};

const buildWrapper = (propOverrides = {}) =>
  mount(OrderForm, {
    props: {
      ...defaultProps,
      ...propOverrides,
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
          template:
            '<input data-testid="salesperson-select" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
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

  it('keeps sales mode on the single-line contract even when prefill contains multiple lines', async () => {
    const wrapper = buildWrapper({
      mode: 'sales',
      salespersons: [],
      statuses: [],
      prefill: {
        files: [{ id: 'file-1', url: '/file/file-1' }],
        lines: [
          { name: 'Desk', quantity: 2, sku: 'SKU-DESK', color: 'Black' },
          { name: 'Chair', quantity: 3, sku: 'SKU-CHAIR', color: 'White' },
        ],
      },
    });

    expect(wrapper.find('[data-testid="toggle-order-lines"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="order-lines-summary"]').exists()).toBe(false);

    await wrapper.get('form').trigger('submit.prevent');

    const [[payload]] = wrapper.emitted('submit');
    expect(payload).toMatchObject({
      name: 'Desk',
      quantity: 2,
      sku: 'SKU-DESK',
      color: 'Black',
      fileIds: ['file-1'],
    });
    expect(payload).not.toHaveProperty('lines');
  });

  it('defaults the salesperson when a sole option arrives after mount', async () => {
    const wrapper = buildWrapper({
      salespersons: [],
      prefill: null,
    });

    expect(wrapper.get('[data-testid="salesperson-select"]').element.value).toBe('');

    await wrapper.setProps({
      salespersons: [{ id: 'sp-1', name: 'Alice' }],
    });

    expect(wrapper.get('[data-testid="salesperson-select"]').element.value).toBe('sp-1');
  });
});
