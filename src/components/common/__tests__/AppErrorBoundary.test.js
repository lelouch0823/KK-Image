import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { h } from 'vue';
import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue';

describe('AppErrorBoundary', () => {
  it('renders fallback when child throws and allows recover', async () => {
    let shouldThrow = true;
    const CrashChild = {
      name: 'CrashChild',
      setup() {
        if (shouldThrow) {
          shouldThrow = false;
          throw new Error('boom');
        }
        return () => h('div', { 'data-testid': 'safe-child' }, 'safe');
      },
    };

    const Host = {
      components: { AppErrorBoundary, CrashChild },
      template: '<AppErrorBoundary><CrashChild /></AppErrorBoundary>',
    };

    const wrapper = mount(Host);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="error-fallback"]').exists()).toBe(true);

    await wrapper.get('[data-testid="retry-action"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="safe-child"]').exists()).toBe(true);
  });
});
