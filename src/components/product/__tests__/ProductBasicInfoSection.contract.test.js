import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import ProductBasicInfoSection from '../ProductBasicInfoSection.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

const AppInputStub = defineComponent({
  name: 'AppInput',
  props: {
    modelValue: { type: [String, Number], default: '' },
    size: { type: String, default: undefined },
  },
  emits: ['update:modelValue'],
  template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
});

describe('ProductBasicInfoSection contract', () => {
  it('updates shared reactive form via AppInput v-model', async () => {
    const form = {
      name: '',
      description: '',
      brand: '',
      series: '',
      category: '',
      currency: 'CNY',
      spu: '',
      slug: '',
    };

    const wrapper = mount(ProductBasicInfoSection, {
      props: {
        form,
        currencyOptions: [{ code: 'CNY', symbol: '¥', label: 'RMB' }],
      },
      global: {
        stubs: {
          AppInput: AppInputStub,
        },
      },
    });

    const inputs = wrapper.findAllComponents(AppInputStub);
    await inputs[0].vm.$emit('update:modelValue', 'Test Product');
    await inputs[2].vm.$emit('update:modelValue', 'Brand-X');
    await inputs[5].vm.$emit('update:modelValue', 'SPU-001');

    expect(form.name).toBe('Test Product');
    expect(form.brand).toBe('Brand-X');
    expect(form.spu).toBe('SPU-001');
  });

  it('updates currency through native select binding', async () => {
    const form = {
      name: '',
      description: '',
      brand: '',
      series: '',
      category: '',
      currency: 'CNY',
      spu: '',
      slug: '',
    };

    const wrapper = mount(ProductBasicInfoSection, {
      props: {
        form,
        currencyOptions: [
          { code: 'CNY', symbol: '¥', label: 'RMB' },
          { code: 'USD', symbol: '$', label: 'USD' },
        ],
      },
      global: {
        stubs: {
          AppInput: AppInputStub,
        },
      },
    });

    await wrapper.find('select').setValue('USD');
    expect(form.currency).toBe('USD');
  });
});
