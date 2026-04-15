import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CalloutPanel from '../composed/CalloutPanel.vue';

describe('CalloutPanel', () => {
  it('renders the shared tone contract and action slot', () => {
    const wrapper = mount(CalloutPanel, {
      props: {
        title: '只读提示',
        tone: 'warning',
        description: '这个流程仅允许 dry run。',
      },
      slots: {
        actions: '<button>Learn more</button>',
      },
    });

    expect(wrapper.get('[data-callout-panel]').attributes('data-tone')).toBe('warning');
    expect(wrapper.get('[data-callout-actions]').text()).toContain('Learn more');
  });
});
