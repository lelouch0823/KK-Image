import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppInput from '../AppInput.vue';

describe('AppInput design contract', () => {
  it('announces error state through aria-invalid and alert messaging', () => {
    const wrapper = mount(AppInput, {
      props: {
        modelValue: '',
        error: 'Required field',
      },
    });

    const input = wrapper.get('input');
    expect(input.attributes('aria-invalid')).toBe('true');

    const error = wrapper.get('[role="alert"]');
    expect(error.text()).toContain('Required field');
  });
});
