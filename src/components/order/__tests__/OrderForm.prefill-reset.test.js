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

describe('OrderForm prefill reset', () => {
  it('clears previous fields and files when prefill becomes an empty object', async () => {
    const wrapper = mount(OrderForm, {
      props: {
        mode: 'sales',
        prefill: {
          name: 'Desk',
          brand: 'ACME',
          files: [{ id: 'file-1', url: '/file/file-1' }],
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
            props: ['modelValue', 'disabled', 'textarea'],
            inheritAttrs: false,
            template: `
              <component
                :is="textarea ? 'textarea' : 'input'"
                :value="modelValue"
                :disabled="disabled"
                @input="$emit('update:modelValue', $event.target.value)"
              />
            `,
          },
          AppButton: true,
          StatusSelector: true,
          Select: true,
          AppIcon: true,
        },
      },
    });

    expect(wrapper.find('input').element.value).toBe('Desk');
    expect(wrapper.get('[data-testid="file-count"]').text()).toBe('1');

    await wrapper.setProps({ prefill: {} });

    expect(wrapper.find('input').element.value).toBe('');
    expect(wrapper.get('[data-testid="file-count"]').text()).toBe('0');
  });
});
