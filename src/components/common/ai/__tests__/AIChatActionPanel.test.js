import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AIChatActionPanel from '../AIChatActionPanel.vue';

describe('AIChatActionPanel', () => {
  it('renders the slot question card for slot_request payloads', () => {
    const wrapper = mount(AIChatActionPanel, {
      props: {
        action: {
          type: 'slot_request',
          missingSlots: ['salespersonId'],
          fields: [
            {
              key: 'salespersonId',
              label: '销售员',
              candidates: [{ value: 'sp-1', label: '张三' }],
            },
          ],
        },
      },
    });

    expect(wrapper.text()).toContain('还需要补充信息');
  });

  it('re-emits confirm from the preview card', async () => {
    const wrapper = mount(AIChatActionPanel, {
      props: {
        action: {
          type: 'action_preview',
          entityType: 'order',
          summary: { productName: '跑鞋', salespersonId: 'sp-1' },
        },
      },
    });

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });
});
