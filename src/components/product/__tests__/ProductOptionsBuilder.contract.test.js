import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import ProductOptionsBuilder from '../ProductOptionsBuilder.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

const AppInputStub = defineComponent({
  name: 'AppInput',
  props: {
    modelValue: { type: [String, Number], default: '' },
    size: { type: String, default: undefined },
  },
  emits: ['update:modelValue', 'input', 'keydown', 'blur'],
  template: `
    <input
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value); $emit('input', $event)"
      @keydown="$emit('keydown', $event)"
      @blur="$emit('blur', $event)"
    />
  `,
});

describe('ProductOptionsBuilder event contract', () => {
  it('emits batch-build and add-option from header actions', async () => {
    const wrapper = mount(ProductOptionsBuilder, {
      props: { options: [] },
      global: { stubs: { AppInput: AppInputStub } },
    });

    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('batch-build')).toHaveLength(1);
    expect(wrapper.emitted('add-option')).toHaveLength(1);
  });

  it('emits full option/value operations with correct payload', async () => {
    const option = {
      id: 'dim-color',
      name: 'Color',
      values: ['Red'],
      inputValue: 'Blue',
      archivedValues: [{ id: 'val-green', value: 'Green', status: 'archived' }],
    };

    const wrapper = mount(ProductOptionsBuilder, {
      props: { options: [option] },
      global: { stubs: { AppInput: AppInputStub } },
    });

    await wrapper.find('button[title="Delete"]').trigger('click');
    expect(wrapper.emitted('remove-option')?.[0]).toEqual([0]);

    const appInputs = wrapper.findAllComponents(AppInputStub);
    await appInputs[0].vm.$emit('input', new Event('input'));
    expect(wrapper.emitted('generate-variants')).toHaveLength(1);

    const enterEvent = { key: 'Enter', preventDefault: vi.fn() };
    await appInputs[1].vm.$emit('keydown', enterEvent);
    expect(wrapper.emitted('add-value')?.[0]).toEqual([
      option,
      expect.objectContaining({ color: expect.any(String) }),
    ]);

    const removeValueButton = wrapper
      .findAll('button')
      .find((btn) => btn.find('.material-symbols-outlined').exists() && btn.find('.material-symbols-outlined').text().trim() === 'close');
    expect(removeValueButton).toBeTruthy();
    await removeValueButton.trigger('click');
    expect(wrapper.emitted('remove-value')?.[0]).toEqual([option, 0]);

    await wrapper.find('[data-testid="restore-value-0-0"]').trigger('click');
    expect(wrapper.emitted('restore-value')?.[0]).toEqual([option, option.archivedValues[0], 0]);
  });
});
