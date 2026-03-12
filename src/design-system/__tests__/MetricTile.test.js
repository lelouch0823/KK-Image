import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MetricTile from '../composed/MetricTile.vue';

describe('MetricTile', () => {
  it('supports a flat mode without card shadows', () => {
    const wrapper = mount(MetricTile, {
      props: {
        label: 'Confirmed',
        value: 12,
        flat: true,
      },
    });

    expect(wrapper.classes()).toContain('shadow-none');
    expect(wrapper.classes()).not.toContain('shadow-sm');
  });
});
