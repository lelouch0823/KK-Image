import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ChatMessage from '../ChatMessage.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, params) => {
      if (key === 'ai.toolLoading') return `正在使用 ${params?.tool || ''}`;
      if (typeof params === 'string') return params;
      return key;
    },
  }),
}));

describe('ChatMessage user multimodal rendering', () => {
  it('renders user text and image parts from multimodal content', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
          ],
          html: '',
        },
      },
    });

    expect(wrapper.text()).toContain('Analyze this image');
    expect(wrapper.find('img[alt="User attached image"]').exists()).toBe(true);
  });

  it('renders unknown tool names as readable labels instead of raw function names', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          role: 'assistant',
          content: '',
          html: '',
        },
        toolStatus: 'run_custom_inventory_audit',
      },
    });

    expect(wrapper.text()).toContain('Run Custom Inventory Audit');
    expect(wrapper.text()).not.toContain('run_custom_inventory_audit');
  });
});
