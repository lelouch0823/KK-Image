import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppSlider from '../AppSlider.vue';

describe('AppSlider behavior', () => {
  it('emits string values from the shared range control', async () => {
    const wrapper = mount(AppSlider, {
      props: {
        modelValue: '0.4',
        min: '0.1',
        max: '1',
        step: '0.1',
      },
    });

    await wrapper.get('input[type="range"]').setValue('0.7');

    expect(wrapper.emitted('update:modelValue')).toEqual([['0.7']]);
  });
});
