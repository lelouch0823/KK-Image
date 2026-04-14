import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTableTextStack from '../AppTableTextStack.vue';

describe('AppTableTextStack', () => {
  it('renders a two-line truncated hierarchy with title fallbacks', () => {
    const wrapper = mount(AppTableTextStack, {
      props: {
        primary: 'Primary Value',
        secondary: 'Secondary Value',
      },
    });

    const lines = wrapper.findAll('div');
    expect(lines[1].classes()).toContain('truncate');
    expect(lines[1].classes()).toContain('font-medium');
    expect(lines[1].attributes('title')).toBe('Primary Value');
    expect(lines[2].classes()).toContain('truncate');
    expect(lines[2].classes()).toContain('text-xs');
    expect(lines[2].attributes('title')).toBe('Secondary Value');
  });

  it('supports tone overrides and hides empty secondary text', () => {
    const wrapper = mount(AppTableTextStack, {
      props: {
        primary: 'AGG-1',
        primaryClass: 'font-mono text-sm',
        secondaryClass: 'text-primary',
      },
    });

    expect(wrapper.text()).toContain('AGG-1');
    expect(wrapper.find('.font-mono').exists()).toBe(true);
    expect(wrapper.find('.text-primary').exists()).toBe(false);
  });
});
