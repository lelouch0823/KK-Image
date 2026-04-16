import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppColorInput from '../AppColorInput.vue';

describe('AppColorInput behavior', () => {
  it('emits the picked color and mirrors the token text', async () => {
    const wrapper = mount(AppColorInput, {
      props: {
        modelValue: '#ffffff',
      },
    });

    const colorInput = wrapper.get('input[type="color"]');
    await colorInput.setValue('#112233');

    expect(wrapper.emitted('update:modelValue')).toEqual([['#112233']]);
    expect(wrapper.text()).toContain('#112233');
  });
});
