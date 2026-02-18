import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Tooltip from '../Tooltip.vue';

describe('Tooltip Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should render trigger content', () => {
    const wrapper = mount(Tooltip, {
      props: { content: 'Tooltip text' },
      slots: { default: '<button id="trigger">Hover me</button>' }
    });
    
    expect(wrapper.find('#trigger').exists()).toBe(true);
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
  });

  it('should show tooltip after delay on mouseenter', async () => {
    const wrapper = mount(Tooltip, {
      props: { content: 'Tooltip text', delay: 100 },
      slots: { default: '<span>Trigger</span>' },
      global: {
        stubs: {
          Teleport: true
        }
      }
    });
    
    await wrapper.trigger('mouseenter');
    
    // Should not be visible immediately
    expect(wrapper.vm.isVisible).toBe(false);
    
    vi.advanceTimersByTime(101);
    expect(wrapper.vm.isVisible).toBe(true);
  });

  it('should hide tooltip on mouseleave', async () => {
    const wrapper = mount(Tooltip, {
      props: { content: 'Tooltip text' },
      slots: { default: '<span>Trigger</span>' },
      global: {
        stubs: {
          Teleport: true
        }
      }
    });
    
    wrapper.vm.isVisible = true;
    await wrapper.trigger('mouseleave');
    
    expect(wrapper.vm.isVisible).toBe(false);
  });
});
