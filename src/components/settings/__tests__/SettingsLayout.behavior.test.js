import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SettingsLayout from '../SettingsLayout.vue';

describe('SettingsLayout behavior', () => {
  it('renders title, description, sidebar, and main content slots', () => {
    const wrapper = mount(SettingsLayout, {
      props: {
        title: 'System Settings',
        description: 'Manage application preferences.',
      },
      slots: {
        sidebar: '<div data-testid="sidebar-slot">Sidebar content</div>',
        default: '<div data-testid="content-slot">Main content</div>',
      },
    });

    expect(wrapper.text()).toContain('System Settings');
    expect(wrapper.text()).toContain('Manage application preferences.');
    expect(wrapper.get('[data-testid="sidebar-slot"]').text()).toBe('Sidebar content');
    expect(wrapper.get('[data-testid="content-slot"]').text()).toBe('Main content');
  });
});
