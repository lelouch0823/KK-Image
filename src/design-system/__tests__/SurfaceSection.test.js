import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SurfaceSection from '../composed/SurfaceSection.vue';

describe('SurfaceSection', () => {
  it('renders a shared reusable surface section with header and actions', () => {
    const wrapper = mount(SurfaceSection, {
      props: {
        title: '库存摘要',
        description: '共享 section 容器',
      },
      slots: {
        default: '<div>Body</div>',
        actions: '<button>Refresh</button>',
      },
    });

    expect(wrapper.get('[data-surface-section]').attributes('data-surface-variant')).toBe('panel');
    expect(wrapper.get('[data-surface-section-header]').text()).toContain('库存摘要');
    expect(wrapper.get('[data-surface-section-actions]').text()).toContain('Refresh');
    expect(wrapper.get('[data-surface-section-body]').text()).toContain('Body');
  });
});
