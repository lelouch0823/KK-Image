import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DestructiveConfirmModal from '@/components/common/DestructiveConfirmModal.vue';

describe('DestructiveConfirmModal', () => {
  it('only emits confirm after the required text matches', async () => {
    const wrapper = mount(DestructiveConfirmModal, {
      props: {
        modelValue: true,
        title: 'Delete item',
        requiredText: 'DELETE',
      },
      global: {
        stubs: {
          Modal: {
            template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>',
            props: ['modelValue', 'title', 'bodyClass', 'closable', 'closeOnBackdrop'],
          },
          ActionBar: {
            template: '<div><slot name="leading" /><slot /></div>',
          },
          AppButton: {
            template:
              '<button :disabled="disabled" @click="$emit(\'click\')">{{ text }}<slot /><slot name="icon-left" /></button>',
            props: ['text', 'disabled', 'loading', 'variant'],
            emits: ['click'],
          },
          AppInput: {
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue', 'type', 'size', 'placeholder'],
            emits: ['update:modelValue'],
          },
          AppIcon: true,
        },
      },
    });

    await wrapper.find('input').setValue('WRONG');
    await wrapper.findAll('button')[1].trigger('click');
    expect(wrapper.emitted('confirm')).toBeFalsy();

    await wrapper.find('input').setValue('DELETE');
    await wrapper.findAll('button')[1].trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });
});
