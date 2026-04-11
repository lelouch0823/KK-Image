import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import SpaceSettingsTab from '../SpaceSettingsTab.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copy: vi.fn(),
  }),
}));

describe('SpaceSettingsTab contract', () => {
  it('keeps share settings dirty until parent props confirm the save', async () => {
    const wrapper = mount(SpaceSettingsTab, {
      props: {
        canManage: true,
        shareMode: 'none',
        sharedSalespersons: [],
      },
      global: {
        stubs: {
          SpaceVisibilitySelector: {
            template: '<div><slot name="footer" /></div>',
            props: ['modelValue', 'selectedSalespersons'],
          },
          AppIcon: true,
        },
      },
    });

    wrapper.vm.currentShareMode = 'selected';
    wrapper.vm.selectedSalespersonIds = ['sp-1'];
    await nextTick();

    expect(wrapper.vm.hasChanges).toBe(true);

    await wrapper.get('button').trigger('click');
    await nextTick();

    expect(wrapper.emitted('update-share-settings')).toEqual([
      [
        {
          shareMode: 'selected',
          sharedSalespersonIds: ['sp-1'],
        },
      ],
    ]);
    expect(wrapper.vm.hasChanges).toBe(true);
  });
});
