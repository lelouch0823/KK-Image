<template>
  <!-- 添加到组件根部的外层包装，不限制拖拽溢出，让窗口可以全屏移动 -->
  <div class="pointer-events-none fixed inset-0 z-9999 overflow-hidden">
    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-4 transform scale-95 opacity-0"
      enter-to-class="translate-y-0 transform scale-100 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 transform scale-100 opacity-100"
      leave-to-class="translate-y-4 transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        ref="widgetEl"
        :style="{
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
        }"
        class="border-border pointer-events-auto absolute flex min-h-[300px] max-w-[calc(100vw-2rem)] min-w-[320px] flex-col overflow-hidden rounded-2xl border bg-(--bg-card) shadow-2xl backdrop-blur-xl"
      >
        <!-- Header -->
        <div ref="dragHandleEl" class="bg-primary flex cursor-move items-center justify-between p-4 text-(--text-inverse) transition-colors hover:bg-primary/90">
          <div class="flex items-center gap-3">
            <div class="flex size-8 items-center justify-center rounded-lg bg-white/20">
              <AppIcon name="bolt" class="size-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold">{{ t('ai.assistant') }}</h3>
              <p class="text-[10px] opacity-70">{{ t('ai.subtitle') }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="messages.length > 1"
              :title="t('ai.clear')"
              class="rounded-lg p-1.5 transition-colors hover:bg-white/10"
              @click="clearHistory"
            >
              <AppIcon name="trash" class="size-5" />
            </button>
            <button
              :title="t('common.close')"
              class="rounded-lg p-1.5 transition-colors hover:bg-white/10"
              @click="close"
            >
              <AppIcon name="x-mark" class="size-5" />
            </button>
          </div>
        </div>

        <!-- Messages Area -->
        <div ref="messageContainer" class="flex-1 space-y-4 overflow-y-auto p-4">
          <ChatMessage
            v-for="(msg, index) in messages"
            :key="index"
            :message="msg"
            :is-thinking="index === messages.length - 1 && isThinking"
            :tool-status="index === messages.length - 1 ? toolStatus : ''"
            :show-report-button="shouldShowReportButtonForMessage(msg, index)"
            :is-generating-report="isGeneratingReport"
            @generate-report="generateReport"
          />
        </div>

        <!-- Input Area -->
        <div class="border-t border-(--border-color) bg-(--bg-card) px-4 pt-1 pb-4">
          <AISuggestions 
            class="mb-2" 
            :suggestions="suggestions" 
            @select="handleSuggestion" 
          />
          
          <form
            class="relative flex items-center"
            @submit.prevent="sendMessage"
          >
            <input
              v-model="userInput"
              :disabled="isStreamingLoading"
              type="text"
              :placeholder="t('ai.placeholder')"
              class="focus:ring-primary/20 focus:ring-2 w-full rounded-xl border-none bg-(--bg-muted) py-3 pr-12 pl-4 text-sm transition-all dark:bg-white/5"
            />
            <button
              :disabled="!userInput.trim() || isStreamingLoading"
              type="submit"
              class="text-primary absolute right-2 rounded-lg p-1.5 transition-all hover:bg-primary/10 disabled:opacity-30"
            >
              <AppIcon name="paper-airplane" class="size-5" />
            </button>
          </form>
        </div>

        <!-- Resize Handle -->
        <div 
          class="absolute right-0 bottom-0 z-10 size-4  cursor-se-resize"
          @mousedown.prevent="startResize"
        ></div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useDraggable, useStorage, useWindowSize } from '@vueuse/core';
import { API as API_URLS } from '@/utils/constants';
import { renderMarkdown } from '@/utils/ai-markdown';
import ChatMessage from '@/components/common/ai/ChatMessage.vue';
import AISuggestions from '@/components/common/ai/AISuggestions.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useI18n } from '@/composables/useI18n';
import { useAI } from '@/composables/useAI';
import { useAIStream } from '@/composables/useAIStream';
import { useToast } from '@/composables/useToast';
import { throttle } from '@/utils/performance';
import { inferCurrentView, inferAIEntityContext } from '@/components/common/ai/context-inference';

const { isOpen, close, context, setContext } = useAI();
const { t } = useI18n();
const { addToast } = useToast();
const route = useRoute();
const { width: windowWidth, height: windowHeight } = useWindowSize();

// 窗口尺寸与位置状态 (持久化)
// 默认右上角对齐 (避开顶栏):
const initialWidth = 420;
const initialHeight = 600;
// 右边距24px
const defaultX = Math.max(0, windowWidth.value - initialWidth - 24); 
// 距离顶部 80px
const defaultY = 80; 

const width = useStorage('ai-chat-width', initialWidth);
const height = useStorage('ai-chat-height', initialHeight);
const storedX = useStorage('ai-chat-x', defaultX);
const storedY = useStorage('ai-chat-y', defaultY);

const widgetEl = ref(null);
const dragHandleEl = ref(null);

const { x, y } = useDraggable(widgetEl, {
  initialValue: { x: storedX.value, y: storedY.value },
  handle: dragHandleEl,
  preventDefault: true,
});

watch([x, y], ([newX, newY]) => {
  storedX.value = newX;
  storedY.value = newY;
});

// 手动实现缩放大小逻辑
let isResizing = false;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;

const startResize = (e) => {
  isResizing = true;
  startX = e.clientX;
  startY = e.clientY;
  startWidth = width.value;
  startHeight = height.value;
  
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
  // 防止拖动时选中文本
  document.body.style.userSelect = 'none';
};

const onResize = (e) => {
  if (!isResizing) return;
  requestAnimationFrame(() => {
    // 最小限制并防溢出
    const newW = Math.max(320, startWidth + (e.clientX - startX));
    const newH = Math.max(300, startHeight + (e.clientY - startY));
    width.value = Math.min(newW, windowWidth.value - x.value - 24);
    height.value = Math.min(newH, windowHeight.value - y.value - 24);
  });
};

const stopResize = () => {
  isResizing = false;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.userSelect = '';
};

// 监听窗口大小变化限制溢出
watch([windowWidth, windowHeight], ([vw, vh]) => {
  if (x.value + width.value > vw) x.value = Math.max(0, vw - width.value - 24);
  if (y.value + height.value > vh) y.value = Math.max(0, vh - height.value - 24);
});

// 从路由计算当前视图和标题
const currentView = computed(() => inferCurrentView(route.path));
const viewTitle = computed(() => route.meta?.title || document.title);
const currentEntityContext = computed(() => inferAIEntityContext({
  view: currentView.value,
  params: route.params,
  query: route.query,
}));

const userInput = ref('');
const messageContainer = ref(null);

// 自动感知上下文
watch(
  [currentView, currentEntityContext],
  ([view, entity]) => {
    setContext({
      path: '/' + view,
      pageTitle: viewTitle.value,
      selectedId: entity.selectedId,
      selectedType: entity.selectedType,
    });
  },
  { immediate: true }
);

// 主动建议逻辑
const suggestions = computed(() => {
  const view = currentView.value;
  const sug = (key) => t(`ai.suggestions.${key}`);
  
  if (view === 'dashboard') {
    return [sug('dailyReport'), sug('monthlySalesRanking'), sug('systemStatus')];
  }
  if (view === 'orders' || view === 'order-detail') {
    return [sug('pendingOrders'), sug('todayNewOrders'), sug('weeklySalesTrend')];
  }
  if (view === 'customers') {
    return [sug('weeklyNewCustomers'), sug('customerCount')];
  }
  if (view === 'spaces' || view === 'space-detail') {
    return [sug('spaceUsage'), sug('recentActiveSpaces'), sug('downloadTop10')];
  }
  if (view === 'files') {
    return [sug('storageUsage'), sug('largeFileAnalysis'), sug('fileTypeDistribution')];
  }
  if (view === 'sales' || view === 'salespersons') {
    return [sug('myDailyPerformance'), sug('monthlyCommission')];
  }
  return [sug('dailyReport'), sug('pendingOrders'), sug('systemStatus')];
});

const handleSuggestion = (text) => {
  userInput.value = text;
  sendMessage();
};

const { 
  stream: startAIStream,
  fullContent,
  displayedContent: streamContent, 
  isThinking,
  isLoading: isStreamingLoading,
  isStreaming: isAIStreaming,
  toolStatus,
} = useAIStream();

const isGeneratingReport = ref(false);

// 判断特定消息是否应显示报告按钮
const shouldShowReportButtonForMessage = (msg, index) => {
  // 正在流式传输时不显示
  if (isAIStreaming.value || isStreamingLoading.value) return false;
  // 必须是 assistant 消息
  if (msg.role !== 'assistant') return false;
  // 必须是最后一条 assistant 消息（避免重复显示）
  const lastAssistantIndex = messages.value.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
  if (index !== lastAssistantIndex) return false;
  // 必须包含报告标记
  return msg.content?.includes('[REPORT_AVAILABLE]');
};

// SOTA: Throttled Markdown rendering - use fullContent for proper parsing
const throttledRender = throttle((content, targetMsg) => {
  if (targetMsg) {
    targetMsg.html = renderMarkdown(content);
    scrollToBottom();
  }
}, 100);

// Listen for streaming content updates
// Use fullContent for markdown rendering (complete text), streamContent for display
watch([fullContent, streamContent], ([full, displayed]) => {
  if (messages.value.length > 0) {
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg.role === 'assistant') {
      lastMsg.content = displayed; // For typewriter display
      // Use fullContent for markdown rendering (contains complete text)
      throttledRender(full, lastMsg);
    }
  }
});

const messages = useStorage('ai-chat-messages', [
  { 
    role: 'assistant', 
    content: t('ai.welcome'),
    html: renderMarkdown(t('ai.welcome'))
  }
]);

const scrollToBottom = async () => {
  await nextTick();
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
  }
};

const clearHistory = () => {
  if (confirm(t('ai.clearConfirm'))) {
    messages.value = [
      { 
        role: 'assistant', 
        content: t('ai.welcome'),
        html: renderMarkdown(t('ai.welcome'))
      }
    ];
  }
};

const sendMessage = async () => {
  if (!userInput.value.trim() || isStreamingLoading.value || isAIStreaming.value) return;

  const userQuery = userInput.value;
  messages.value.push({ role: 'user', content: userQuery, html: '' });
  userInput.value = '';
  // loading state managed by useAIStream
  toolStatus.value = '';
  await scrollToBottom();

  // Add placeholder for assistant response
  messages.value.push({ role: 'assistant', content: '', html: '' });
  
  const historyToSend = messages.value.slice(-8, -1).map(({ role, content }) => ({ role, content }));

  try {
    await startAIStream({
      messages: historyToSend,
      context: context.value
    });

    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      // Final render with complete fullContent for proper markdown parsing
      lastMsg.content = fullContent.value;
      lastMsg.html = renderMarkdown(fullContent.value);
      if (!lastMsg.content) {
        messages.value.pop();
      }
    }
  } catch (_err) {
    // Error is handled in useAIStream (toast)
  } finally {
    await scrollToBottom();
  }
};

/**
 * 生成并打开完整 HTML 报告
 */
const generateReport = async () => {
  isGeneratingReport.value = true;
  
  try {
    const response = await fetch(API_URLS.AI.REPORT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: context.value })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const html = data.data?.html || data.html;

    if (!html) {
      throw new Error('No HTML content received');
    }

    // 创建 Blob URL 并在新窗口打开
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // 延迟释放 URL
    setTimeout(() => URL.revokeObjectURL(url), 60000);

    addToast({ message: t('ai.reportGenerated'), type: 'success' });
  } catch (err) {
    console.error('[AI Report] Error:', err);
    addToast({ message: t('ai.reportError'), type: 'error' });
  } finally {
    isGeneratingReport.value = false;
  }
};
</script>

<style>
.markdown-body {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-main);
  word-break: break-word;
}
.markdown-body > *:first-child {
  margin-top: 0;
}
.markdown-body > *:last-child {
  margin-bottom: 0;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
  color: var(--text-main);
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
  line-height: 1.3;
}
.markdown-body h1 { font-size: 1.25em; }
.markdown-body h2 { font-size: 1.15em; }
.markdown-body h3 { font-size: 1.05em; }
.markdown-body p {
  margin-top: 0;
  margin-bottom: 0.75em;
}
.markdown-body a {
  color: var(--color-info);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}
.markdown-body a:hover {
  border-bottom-color: var(--color-info);
}
.markdown-body ul, .markdown-body ol {
  padding-left: 1.5em;
  margin-top: 0;
  margin-bottom: 0.75em;
}
.markdown-body ul { list-style-type: disc; }
.markdown-body ol { list-style-type: decimal; }
.markdown-body li { margin-bottom: 0.25em; }
.markdown-body li > p { margin-bottom: 0.25em; }
.markdown-body blockquote {
  margin: 0 0 0.75em 0;
  padding: 0.5em 1em;
  color: var(--text-secondary);
  border-left: 3px solid var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 5%, transparent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.markdown-body blockquote p:last-child { margin-bottom: 0; }
.markdown-body code {
  color: var(--text-main);
  background-color: var(--bg-muted);
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.85em;
}
.markdown-body pre {
  background-color: var(--bg-muted);
  padding: 1em;
  border-radius: var(--radius-lg);
  overflow-x: auto;
  margin-top: 0;
  margin-bottom: 0.75em;
  border: 1px solid var(--border-color);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}
.markdown-body pre code {
  color: var(--text-main);
  background-color: transparent;
  padding: 0;
  font-size: 0.85em;
  border-radius: 0;
  white-space: pre;
  word-break: normal;
}
.markdown-body table {
  width: 100%;
  max-width: 100%;
  border-collapse: collapse;
  margin-top: 0;
  margin-bottom: 0.75em;
  display: block;
  overflow-x: auto;
  white-space: nowrap;
}
.markdown-body th, .markdown-body td {
  padding: 0.5em 0.75em;
  border: 1px solid var(--border-color);
  font-size: 0.85em;
}
.markdown-body th {
  font-weight: 600;
  background-color: var(--bg-muted);
  color: var(--text-secondary);
  text-align: left;
}
.markdown-body tr:nth-child(2n) {
  background-color: color-mix(in srgb, var(--bg-muted) 30%, transparent);
}
</style>
