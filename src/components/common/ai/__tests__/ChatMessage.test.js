import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ChatMessage from '../ChatMessage.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
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
});
