import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppCard from '../AppCard.vue';

describe('AppCard design contract', () => {
  it('renders glow state without runtime errors and emits click when clickable', async () => {
    const wrapper = mount(AppCard, {
      props: {
        clickable: true,
        indicator: 'purple',
        glow: true,
      },
      slots: {
        header: '<div>Header</div>',
        default: '<div>Body</div>',
      },
    });

    expect(wrapper.text()).toContain('Header');
    expect(wrapper.text()).toContain('Body');

    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
    expect(wrapper.attributes('data-tone')).toBe('primary');
    expect(wrapper.html()).not.toContain('purple-500');
  });
});
