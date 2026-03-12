import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SummaryStrip from '../composed/SummaryStrip.vue';

describe('SummaryStrip', () => {
  it('supports a flat mode without shadows', () => {
    const wrapper = mount(SummaryStrip, {
      props: {
        flat: true,
      },
      slots: {
        default: '<span>Total</span>',
      },
    });

    expect(wrapper.classes()).toContain('shadow-none');
    expect(wrapper.classes()).not.toContain('shadow-sm');
  });
});
