import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTableStatusPill from '../AppTableStatusPill.vue';

describe('AppTableStatusPill', () => {
  it('renders a compact single-line status pill with title fallback', () => {
    const wrapper = mount(AppTableStatusPill, {
      props: {
        label: 'In Progress',
        variant: 'info',
        dot: true,
        size: 'sm',
      },
    });

    expect(wrapper.text()).toContain('In Progress');
    expect(wrapper.attributes('title')).toBe('In Progress');
    expect(wrapper.classes()).toContain('whitespace-nowrap');
    expect(wrapper.classes()).toContain('!text-xs');
  });

  it('uses tighter dense sizing for xs table pills', () => {
    const wrapper = mount(AppTableStatusPill, {
      props: {
        label: 'Pending',
        size: 'xs',
      },
    });

    expect(wrapper.classes()).toContain('!text-[10px]');
    expect(wrapper.classes()).toContain('!px-2');
  });
});
