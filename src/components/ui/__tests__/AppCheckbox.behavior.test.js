import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppCheckbox from '../AppCheckbox.vue';

describe('AppCheckbox behavior', () => {
  it('syncs the native indeterminate state for partial selection controls', async () => {
    const wrapper = mount(AppCheckbox, {
      props: {
        checked: false,
        indeterminate: true,
      },
    });

    const input = wrapper.get('input').element;
    expect(input.indeterminate).toBe(true);

    await wrapper.setProps({ indeterminate: false, checked: true });
    expect(input.indeterminate).toBe(false);
    expect(input.checked).toBe(true);
  });
});
