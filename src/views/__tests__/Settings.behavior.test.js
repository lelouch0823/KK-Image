import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Settings from '../Settings.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_key, fallback) => fallback || '' }),
}));

describe('Settings view behavior', () => {
  function createWrapper() {
    return mount(Settings, {
      global: {
        stubs: {
          SettingsLayout: {
            props: ['title', 'description'],
            template: `
              <section>
                <h1 data-testid="title">{{ title }}</h1>
                <p data-testid="description">{{ description }}</p>
                <slot name="sidebar" />
                <slot />
              </section>
            `,
          },
          SettingsSidebar: {
            props: ['currentTab', 'items'],
            template: `
              <nav>
                <button
                  v-for="item in items"
                  :key="item.id"
                  :data-tab="item.id"
                  @click="$emit('update:currentTab', item.id)"
                >
                  {{ item.label }}<span v-if="item.badge"> {{ item.badge }}</span>
                </button>
              </nav>
            `,
          },
          AISettings: { template: '<div data-testid="tab-content">AI Settings</div>' },
          WatermarkSettings: { template: '<div data-testid="tab-content">Watermark Settings</div>' },
          BackupSettings: { template: '<div data-testid="tab-content">System Backups</div>' },
        },
      },
    });
  }

  it('shows AI settings by default', () => {
    const wrapper = createWrapper();

    expect(wrapper.get('[data-testid="title"]').text()).toBe('AI Configuration');
    expect(wrapper.get('[data-testid="description"]').text()).toBe(
      'Manage API keys and model preferences for the AI assistant.'
    );
    expect(wrapper.get('[data-testid="tab-content"]').text()).toBe('AI Settings');
    expect(wrapper.text()).toContain('New');
  });

  it('switches to watermark and backup tabs through sidebar updates', async () => {
    const wrapper = createWrapper();
    const buttons = wrapper.findAll('button');

    await buttons[1].trigger('click');
    expect(wrapper.get('[data-testid="title"]').text()).toBe('Watermark Settings');
    expect(wrapper.get('[data-testid="description"]').text()).toBe(
      'Configure global text watermark applied to uploaded images.'
    );
    expect(wrapper.get('[data-testid="tab-content"]').text()).toBe('Watermark Settings');

    await buttons[5].trigger('click');
    expect(wrapper.get('[data-testid="title"]').text()).toBe('System Backups');
    expect(wrapper.get('[data-testid="description"]').text()).toBe(
      'Create and download full system backups including database and stored files.'
    );
    expect(wrapper.get('[data-testid="tab-content"]').text()).toBe('System Backups');
  });
});
