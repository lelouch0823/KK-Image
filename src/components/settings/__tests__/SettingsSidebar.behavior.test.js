import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SettingsSidebar from '../SettingsSidebar.vue';

describe('SettingsSidebar behavior', () => {
  it('renders navigation items, badges, and emits tab updates on click', async () => {
    const wrapper = mount(SettingsSidebar, {
      props: {
        currentTab: 'ai',
        items: [
          { id: 'ai', label: 'AI Configuration', icon: 'sparkles' },
          { id: 'watermark', label: 'Watermark', icon: 'photo', badge: 'New' },
          { id: 'backups', label: 'System Backups', icon: 'cloud-arrow-up' },
        ],
      },
      global: {
        stubs: {
          AppButton: {
            emits: ['click'],
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          },
          AppIcon: {
            props: ['name'],
            template: '<i :data-icon="name" />',
          },
        },
      },
    });

    const buttons = wrapper.findAll('button');

    expect(buttons).toHaveLength(3);
    expect(wrapper.text()).toContain('AI Configuration');
    expect(wrapper.text()).toContain('Watermark');
    expect(wrapper.text()).toContain('System Backups');
    expect(wrapper.text()).toContain('New');
    expect(wrapper.find('[data-icon="photo"]').exists()).toBe(true);

    await buttons[1].trigger('click');

    expect(wrapper.emitted('update:currentTab')).toContainEqual(['watermark']);
  });
});
