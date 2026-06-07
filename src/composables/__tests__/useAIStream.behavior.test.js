import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useAIStream } from '../useAIStream';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  requestAuth: vi.fn(),
  publishRefresh: vi.fn(),
  parserFeed: vi.fn(),
  classifyStreamFailure: vi.fn(),
  pushToTypewriter: vi.fn(),
  resetTypewriter: vi.fn(),
  fullContent: { value: '' },
  displayedContent: { value: '' },
  isTyping: { value: false },
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

vi.mock('@/composables/useRequestAdapters', () => ({
  useRequestAdapters: () => ({ requestAuth: mocks.requestAuth }),
}));

vi.mock('@/composables/useAppRefreshBus', () => ({
  useAppRefreshBus: () => ({ publishRefresh: mocks.publishRefresh }),
}));

vi.mock('@/utils/streaming', () => ({
  SSEParser: class SSEParser {
    feed(chunk) {
      return mocks.parserFeed(chunk);
    }
  },
}));

vi.mock('@/composables/useSmoothTypewriter', () => ({
  useSmoothTypewriter: () => ({
    fullContent: mocks.fullContent,
    displayedContent: mocks.displayedContent,
    isTyping: mocks.isTyping,
    push: (content) => {
      mocks.pushToTypewriter(content);
      mocks.fullContent.value += content;
      mocks.displayedContent.value += content;
      mocks.isTyping.value = true;
    },
    reset: () => {
      mocks.resetTypewriter();
      mocks.fullContent.value = '';
      mocks.displayedContent.value = '';
      mocks.isTyping.value = false;
    },
  }),
}));

vi.mock('@/composables/ai/streamErrorState', () => ({
  classifyStreamFailure: (payload) => mocks.classifyStreamFailure(payload),
}));

function createReader(chunks) {
  let index = 0;
  return {
    read: vi.fn(async () => {
      if (index >= chunks.length) {
        return { done: true, value: undefined };
      }
      const value = new TextEncoder().encode(chunks[index]);
      index += 1;
      return { done: false, value };
    }),
  };
}

function mountHarness() {
  let api;
  const Harness = defineComponent({
    setup() {
      api = useAIStream();
      return () => null;
    },
  });

  const wrapper = mount(Harness);
  return { wrapper, api };
}

describe('useAIStream behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fullContent.value = '';
    mocks.displayedContent.value = '';
    mocks.isTyping.value = false;
    mocks.classifyStreamFailure.mockReturnValue({ category: 'generic', userMessage: '' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams text, action cards, refresh events, and model switch notices', async () => {
    mocks.parserFeed.mockReturnValueOnce([
      { type: 'text_delta', data: { content: '你好<arg_key>坏</arg_key>' } },
      { type: 'content_block', data: { content: '，世界' } },
      { type: 'tool_call', data: { name: 'search' } },
      { type: 'tool_result', data: { result: 'done' } },
      { type: 'action_preview', data: { sessionId: 'act-1', title: '确认预览' } },
      { type: 'module_refresh', data: { module: 'orders', reason: 'ai_created' } },
    ]);

    mocks.requestAuth.mockResolvedValue({
      body: {
        getReader: () => createReader(['chunk-1']),
      },
    });

    const { api } = mountHarness();
    await api.stream({
      messages: [{ role: 'user', content: 'hello' }],
      context: { route: 'orders' },
    });

    expect(mocks.requestAuth).toHaveBeenCalledWith(
      '/api/manage/ai/stream',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(mocks.pushToTypewriter).toHaveBeenCalled();
    expect(api.fullContent.value).toContain('你好');
    expect(api.fullContent.value).toContain('世界');
    expect(api.fullContent.value).not.toContain('arg_key');
    expect(api.actionCard.value).toEqual(
      expect.objectContaining({ type: 'action_preview', title: '确认预览' })
    );
    expect(mocks.publishRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'orders' })
    );
    expect(api.isLoading.value).toBe(false);
    expect(api.isStreaming.value).toBe(false);
  });

  it('shows an info toast when the stream reports a model switch', async () => {
    mocks.parserFeed.mockReturnValueOnce([{ type: 'model_switch', data: { from: 'a', to: 'b' } }]);
    mocks.requestAuth.mockResolvedValue({
      body: {
        getReader: () => createReader(['chunk-1']),
      },
    });

    const { api } = mountHarness();
    await api.stream({
      messages: [{ role: 'user', content: 'hello' }],
      context: {},
    });

    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'ai.modelSwitch', type: 'info' });
  });

  it('surfaces structured tool errors without adding a generic network toast', async () => {
    mocks.parserFeed.mockReturnValueOnce([{ type: 'error', data: { message: 'tool failed' } }]);
    mocks.classifyStreamFailure.mockReturnValue({
      category: 'tool_error',
      userMessage: 'Tool failed loudly',
    });
    mocks.requestAuth.mockResolvedValue({
      body: {
        getReader: () => createReader(['chunk-1']),
      },
    });

    const { api } = mountHarness();

    await expect(
      api.stream({
        messages: [{ role: 'user', content: 'hello' }],
        context: {},
      })
    ).rejects.toMatchObject({
      isHandled: true,
      category: 'tool_error',
      message: 'Tool failed loudly',
    });

    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'Tool failed loudly', type: 'error' });
    expect(mocks.addToast).not.toHaveBeenCalledWith({ message: 'ai.networkError', type: 'error' });
  });

  it('maps image format errors to the specialized toast branch', async () => {
    mocks.parserFeed.mockReturnValueOnce([
      {
        type: 'error',
        data: { message: 'AI API error (400): invalid image_url.url data:image/webp;base64' },
      },
    ]);
    mocks.requestAuth.mockResolvedValue({
      body: {
        getReader: () => createReader(['chunk-1']),
      },
    });

    const { api } = mountHarness();

    await expect(
      api.stream({
        messages: [{ role: 'user', content: 'hello' }],
        context: {},
      })
    ).rejects.toMatchObject({
      isHandled: true,
      isImageError: true,
      imageErrorKind: 'image_input_format',
    });

    expect(mocks.addToast).toHaveBeenCalledWith({
      message:
        '当前 API 网关不接受该图片输入格式，请优先使用 JPG/PNG，或切换支持 data URL 的多模态模型。',
      type: 'error',
    });
  });

  it('cancels the current request and resets loading state', async () => {
    let capturedSignal;
    mocks.requestAuth.mockImplementation(async (_url, options) => {
      capturedSignal = options.signal;
      await new Promise(() => {});
    });

    const { api } = mountHarness();
    void api.stream({
      messages: [{ role: 'user', content: 'hello' }],
      context: {},
    });

    expect(api.isLoading.value).toBe(true);
    api.cancel();

    expect(capturedSignal.aborted).toBe(true);
    expect(api.isLoading.value).toBe(false);
    expect(api.isStreaming.value).toBe(false);
    expect(api.toolStatus.value).toBe('');
  });
});
