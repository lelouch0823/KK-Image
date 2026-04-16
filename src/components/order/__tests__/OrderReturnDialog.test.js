import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderReturnDialog from '@/components/order/OrderReturnDialog.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_key, fallback) => fallback || _key }),
}));

describe('OrderReturnDialog', () => {
  it('requires a reason code before confirming a structured return', async () => {
    const wrapper = mount(OrderReturnDialog, {
      props: {
        modelValue: true,
        quantity: 2,
        lineLabel: 'Chair',
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot /><slot name="footer" /></div>', props: ['modelValue', 'title', 'size', 'bodyClass'] },
          AppInput: {
            template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>',
            props: ['modelValue'],
          },
          Select: {
            template: `
              <select
                data-testid="return-reason-select"
                :value="modelValue"
                @change="$emit('update:modelValue', $event.target.value)"
              >
                <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            `,
            props: ['modelValue', 'options'],
          },
          AppButton: {
            template: '<button :disabled="disabled" @click.stop="$emit(\'click\')"><slot>{{ text }}</slot></button>',
            props: ['text', 'variant', 'disabled', 'loading'],
          },
        },
      },
    });

    expect(wrapper.get('[data-testid="return-confirm-button"]').attributes('disabled')).toBeDefined();

    await wrapper.get('[data-testid="return-reason-select"]').setValue('damage');
    expect(wrapper.get('[data-testid="return-confirm-button"]').attributes('disabled')).toBeUndefined();
  });

  it('emits confirm with reason code and note', async () => {
    const wrapper = mount(OrderReturnDialog, {
      props: {
        modelValue: true,
        quantity: 1,
        lineLabel: 'Chair',
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot /><slot name="footer" /></div>', props: ['modelValue', 'title', 'size', 'bodyClass'] },
          AppInput: {
            template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>',
            props: ['modelValue'],
          },
          Select: {
            template: `
              <select
                data-testid="return-reason-select"
                :value="modelValue"
                @change="$emit('update:modelValue', $event.target.value)"
              >
                <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            `,
            props: ['modelValue', 'options'],
          },
          AppButton: {
            template: '<button :disabled="disabled" @click.stop="$emit(\'click\')"><slot>{{ text }}</slot></button>',
            props: ['text', 'variant', 'disabled', 'loading'],
          },
        },
      },
    });

    await wrapper.get('[data-testid="return-reason-select"]').setValue('wrong_item');
    await wrapper.get('textarea').setValue('customer reported wrong sku');
    await wrapper.get('[data-testid="return-confirm-button"]').trigger('click');

    expect(wrapper.emitted('confirm')?.[0]).toEqual([
      { reason: 'wrong_item', note: 'customer reported wrong sku' },
    ]);
  });
});
