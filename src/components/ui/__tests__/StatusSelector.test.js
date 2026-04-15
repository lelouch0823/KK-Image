import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusSelector from '../StatusSelector.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('StatusSelector', () => {
  it('renders fulfilled with the success dot mapping used by terminal fulfillment states', () => {
    const wrapper = mount(StatusSelector, {
      props: {
        modelValue: 'fulfilled',
        options: ['fulfilled'],
      },
      global: {
        stubs: {
          AppIcon: true,
        },
      },
    });

    expect(wrapper.find('span.size-2').classes()).toContain('bg-success');
  });
});
