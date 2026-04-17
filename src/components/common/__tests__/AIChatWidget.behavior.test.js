import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import AIChatWidget from '../AIChatWidget.vue';

const mocks = vi.hoisted(() => ({
  route: {
    path: '/admin/orders',
    meta: { title: '订单中心' },
    params: {},
    query: {},
  },
  currentView: 'orders',
  entityContext: { selectedId: 'order-1', selectedType: 'order' },
  close: vi.fn(),
  setContext: vi.fn(),
  addToast: vi.fn(),
  requestAuth: vi.fn(),
  startAIStream: vi.fn(),
  compressImageToDataUrl: vi.fn(),
  appendUserMessage: vi.fn(),
  beginAssistantDraft: vi.fn(),
  applyStreamState: vi.fn(),
  finalizeAssistantDraft: vi.fn(),
  discardEmptyAssistantDraft: vi.fn(),
  resetMessages: vi.fn(),
  removeImagesFromLatestUserMessage: vi.fn(),
  aiState: null,
  sessionState: null,
  streamState: null,
}));

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
}));

vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue');

  return {
    useDraggable: () => ({
      x: ref(120),
      y: ref(80),
    }),
    useStorage: (_key, initialValue) => ref(initialValue),
    useWindowSize: () => ({
      width: ref(1440),
      height: ref(960),
    }),
  };
});

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback ?? key,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast: mocks.addToast,
  }),
}));

vi.mock('@/composables/useRequestAdapters', () => ({
  useRequestAdapters: () => ({
    requestAuth: mocks.requestAuth,
  }),
}));

vi.mock('@/components/common/ai/context-inference', () => ({
  inferCurrentView: () => mocks.currentView,
  inferAIEntityContext: () => mocks.entityContext,
}));

vi.mock('@/composables/useAI', async () => {
  const { ref } = await import('vue');

  const isOpen = ref(true);
  const context = ref({ source: 'test' });
  mocks.aiState = { isOpen, context };

  return {
    useAI: () => ({
      isOpen,
      close: mocks.close,
      context,
      setContext: mocks.setContext,
    }),
  };
});

vi.mock('@/composables/useAIChatSession', async () => {
  const { ref } = await import('vue');

  const messages = ref([{ role: 'assistant', content: '欢迎使用' }]);
  mocks.sessionState = { messages };

  return {
    useAIChatSession: () => ({
      messages,
      appendUserMessage: mocks.appendUserMessage,
      beginAssistantDraft: mocks.beginAssistantDraft,
      applyStreamState: mocks.applyStreamState,
      finalizeAssistantDraft: mocks.finalizeAssistantDraft,
      discardEmptyAssistantDraft: mocks.discardEmptyAssistantDraft,
      resetMessages: mocks.resetMessages,
      removeImagesFromLatestUserMessage: mocks.removeImagesFromLatestUserMessage,
    }),
  };
});

vi.mock('@/composables/useAIStream', async () => {
  const { ref } = await import('vue');

  const fullContent = ref('');
  const displayedContent = ref('');
  const isThinking = ref(false);
  const isLoading = ref(false);
  const isStreaming = ref(false);
  const toolStatus = ref('');
  const actionCard = ref(null);

  mocks.streamState = {
    fullContent,
    displayedContent,
    isThinking,
    isLoading,
    isStreaming,
    toolStatus,
    actionCard,
  };

  return {
    useAIStream: () => ({
      stream: mocks.startAIStream,
      fullContent,
      displayedContent,
      isThinking,
      isLoading,
      isStreaming,
      toolStatus,
      actionCard,
    }),
  };
});

vi.mock('@/composables/useImageCompression', () => ({
  useImageCompression: () => ({
    compressImageToDataUrl: mocks.compressImageToDataUrl,
  }),
}));

const AppButtonStub = defineComponent({
  name: 'AppButtonStub',
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    type: {
      type: String,
      default: 'button',
    },
  },
  emits: ['click', 'mousedown'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          type: props.type,
          disabled: props.disabled,
          onClick: (event) => emit('click', event),
          onMousedown: (event) => emit('mousedown', event),
        },
        slots.default ? slots.default() : slots['icon-left']?.()
      );
  },
});

const AppInputStub = defineComponent({
  name: 'AppInputStub',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: String,
      default: '',
    },
    disabled: Boolean,
  },
  emits: ['update:modelValue', 'paste'],
  setup(props, { attrs, emit }) {
    return () =>
      h('input', {
        ...attrs,
        value: props.modelValue,
        disabled: props.disabled,
        onInput: (event) => emit('update:modelValue', event.target.value),
        onPaste: (event) => emit('paste', event),
      });
  },
});

const ChatMessageStub = defineComponent({
  name: 'ChatMessageStub',
  props: {
    message: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h(
        'div',
        { 'data-testid': 'chat-message' },
        Array.isArray(props.message.content)
          ? props.message.content.map((item) => item.text || item.image_url?.url).join(' | ')
          : props.message.content
      );
  },
});

const AISuggestionsStub = defineComponent({
  name: 'AISuggestionsStub',
  props: {
    suggestions: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['select'],
  setup(props, { emit }) {
    return () =>
      h(
        'div',
        { 'data-testid': 'suggestions' },
        props.suggestions.map((suggestion) =>
          h(
            'button',
            {
              type: 'button',
              onClick: () => emit('select', suggestion),
            },
            suggestion
          )
        )
      );
  },
});

const AIChatActionPanelStub = defineComponent({
  name: 'AIChatActionPanelStub',
  props: {
    action: {
      type: Object,
      default: null,
    },
  },
  emits: ['select', 'confirm'],
  setup(_props, { emit }) {
    return () =>
      h('div', { 'data-testid': 'action-panel' }, [
        h(
          'button',
          {
            type: 'button',
            'data-testid': 'candidate-select',
            onClick: () => emit('select', { candidate: { value: '候选值' } }),
          },
          'select'
        ),
        h(
          'button',
          {
            type: 'button',
            'data-testid': 'confirm-action',
            onClick: () => emit('confirm'),
          },
          'confirm'
        ),
      ]);
  },
});

const createWrapper = () =>
  mount(AIChatWidget, {
    global: {
      stubs: {
        transition: false,
        AppButton: AppButtonStub,
        AppInput: AppInputStub,
        AppCard: { template: '<div><slot /></div>' },
        AppIcon: true,
        ActionBar: { template: '<div><slot /></div>' },
        ChatMessage: ChatMessageStub,
        AISuggestions: AISuggestionsStub,
        AIChatActionPanel: AIChatActionPanelStub,
      },
    },
  });

const resetSessionMocks = () => {
  mocks.sessionState.messages.value = [{ role: 'assistant', content: '欢迎使用' }];

  mocks.appendUserMessage.mockImplementation((content) => {
    mocks.sessionState.messages.value.push({ role: 'user', content });
  });
  mocks.beginAssistantDraft.mockImplementation(() => {
    mocks.sessionState.messages.value.push({ role: 'assistant', content: '' });
  });
  mocks.finalizeAssistantDraft.mockImplementation((content) => {
    const lastMessage = mocks.sessionState.messages.value[mocks.sessionState.messages.value.length - 1];
    if (lastMessage?.role === 'assistant') {
      lastMessage.content = content;
    }
  });
  mocks.discardEmptyAssistantDraft.mockImplementation(() => {
    const lastMessage = mocks.sessionState.messages.value[mocks.sessionState.messages.value.length - 1];
    if (lastMessage?.role === 'assistant' && !lastMessage.content) {
      mocks.sessionState.messages.value.pop();
    }
  });
  mocks.resetMessages.mockImplementation(() => {
    mocks.sessionState.messages.value = [{ role: 'assistant', content: '欢迎使用' }];
  });
  mocks.removeImagesFromLatestUserMessage.mockImplementation(() => {
    const lastUserMessage = [...mocks.sessionState.messages.value].reverse().find((message) => message.role === 'user');
    if (lastUserMessage && Array.isArray(lastUserMessage.content)) {
      lastUserMessage.content = lastUserMessage.content.filter((item) => item.type !== 'image_url');
    }
  });
  mocks.applyStreamState.mockImplementation(({ fullContent, displayedContent }) => {
    const lastMessage = mocks.sessionState.messages.value[mocks.sessionState.messages.value.length - 1];
    if (lastMessage?.role === 'assistant') {
      lastMessage.content = fullContent || displayedContent;
    }
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});

  mocks.route.path = '/admin/orders';
  mocks.route.meta = { title: '订单中心' };
  mocks.route.params = {};
  mocks.route.query = {};
  mocks.currentView = 'orders';
  mocks.entityContext = { selectedId: 'order-1', selectedType: 'order' };

  mocks.aiState.isOpen.value = true;
  mocks.aiState.context.value = { source: 'test' };

  mocks.streamState.fullContent.value = '';
  mocks.streamState.displayedContent.value = '';
  mocks.streamState.isThinking.value = false;
  mocks.streamState.isLoading.value = false;
  mocks.streamState.isStreaming.value = false;
  mocks.streamState.toolStatus.value = '';
  mocks.streamState.actionCard.value = null;

  resetSessionMocks();

  mocks.startAIStream.mockImplementation(async () => {
    mocks.streamState.fullContent.value = 'AI 回复';
    mocks.streamState.displayedContent.value = 'AI 回复';
  });
  mocks.compressImageToDataUrl.mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,mock' });
  mocks.requestAuth.mockResolvedValue({
    json: () => Promise.resolve({ data: { html: '<h1>Report</h1>' } }),
  });

  vi.stubGlobal('requestAnimationFrame', (callback) => {
    callback();
    return 1;
  });
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('open', vi.fn());
  vi.stubGlobal('Blob', Blob);

  const createObjectURL = vi.fn(() => 'blob:report');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', {
    createObjectURL,
    revokeObjectURL,
  });
});

describe('AIChatWidget behavior', () => {
  it('renders contextual suggestions and syncs inferred AI context on mount', async () => {
    const wrapper = createWrapper();
    await nextTick();

    expect(wrapper.text()).toContain('ai.suggestions.pendingOrders');
    expect(wrapper.text()).toContain('ai.suggestions.todayNewOrders');
    expect(mocks.setContext).toHaveBeenCalledWith({
      path: '/orders',
      pageTitle: '订单中心',
      selectedId: 'order-1',
      selectedType: 'order',
    });
  });

  it('sends user text to the AI stream and finalizes the assistant draft', async () => {
    vi.useFakeTimers();
    const wrapper = createWrapper();

    await wrapper.find('input[placeholder="ai.placeholder"]').setValue('帮我总结今天订单');
    await wrapper.find('form').trigger('submit.prevent');
    await vi.runAllTimersAsync();
    await flushPromises();

    expect(mocks.appendUserMessage).toHaveBeenCalledWith([
      { type: 'text', text: '帮我总结今天订单' },
    ]);
    expect(mocks.beginAssistantDraft).toHaveBeenCalledTimes(1);
    expect(mocks.startAIStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { source: 'test' },
      })
    );
    expect(mocks.finalizeAssistantDraft).toHaveBeenCalledWith('AI 回复');

    vi.useRealTimers();
  });

  it('adds the image fallback prompt and strips unsupported-image markers from replies', async () => {
    vi.useFakeTimers();
    mocks.startAIStream.mockImplementation(async () => {
      mocks.streamState.fullContent.value = '[IMAGE_UNSUPPORTED]请改用文字描述';
      mocks.streamState.displayedContent.value = '[IMAGE_UNSUPPORTED]请改用文字描述';
    });

    const wrapper = createWrapper();
    wrapper.vm.attachedImage = 'data:image/png;base64,abc';
    await nextTick();

    await wrapper.find('form').trigger('submit.prevent');
    await vi.runAllTimersAsync();
    await flushPromises();

    expect(mocks.appendUserMessage).toHaveBeenCalledWith([
      { type: 'text', text: '请分析这张图片' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
    ]);
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: '当前模型不支持识别图片，请移除图片或切换模型。',
      type: 'error',
    });
    expect(mocks.finalizeAssistantDraft).toHaveBeenCalledWith('请改用文字描述');

    vi.useRealTimers();
  });

  it('rejects invalid uploads and reports compression failures for image files', async () => {
    const wrapper = createWrapper();
    const fileInput = wrapper.find('input[type="file"]');
    const setFiles = (files, value) => {
      Object.defineProperty(fileInput.element, 'files', {
        configurable: true,
        value: files,
      });
      Object.defineProperty(fileInput.element, 'value', {
        configurable: true,
        writable: true,
        value,
      });
    };

    setFiles([new File(['demo'], 'notes.txt', { type: 'text/plain' })], 'notes.txt');
    await fileInput.trigger('change');

    expect(mocks.addToast).toHaveBeenCalledWith({
      message: '仅支持图片格式文件',
      type: 'error',
    });

    mocks.addToast.mockClear();
    mocks.compressImageToDataUrl.mockRejectedValueOnce(new Error('compression failed'));

    setFiles([new File(['img'], 'photo.png', { type: 'image/png' })], 'photo.png');
    await fileInput.trigger('change');
    await flushPromises();

    expect(mocks.addToast).toHaveBeenCalledWith({
      message: '处理图片失败',
      type: 'error',
    });
  });

  it('generates a report in a new window and clears history after confirmation', async () => {
    vi.useFakeTimers();
    mocks.sessionState.messages.value = [
      { role: 'assistant', content: '欢迎使用' },
      { role: 'assistant', content: '[REPORT_AVAILABLE]总结' },
    ];

    const wrapper = createWrapper();

    await wrapper.vm.generateReport();
    await flushPromises();
    await vi.runAllTimersAsync();

    expect(mocks.requestAuth).toHaveBeenCalledWith(
      '/api/manage/ai/report',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(globalThis.open).toHaveBeenCalledWith('blob:report', '_blank');
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'ai.reportGenerated',
      type: 'success',
    });

    await wrapper.find('button[title="ai.clear"]').trigger('click');

    expect(globalThis.confirm).toHaveBeenCalledWith('ai.clearConfirm');
    expect(mocks.resetMessages).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
