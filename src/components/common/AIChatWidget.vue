<template>
  <div class="pointer-events-none fixed right-6 bottom-6 z-9999">
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
        class="border-border pointer-events-auto absolute right-0 bottom-0 flex h-[600px] w-[420px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border bg-(--bg-card) shadow-2xl backdrop-blur-xl"
      >
        <!-- Header -->
        <div class="bg-primary flex items-center justify-between p-4 text-(--text-inverse)">
          <div class="flex items-center gap-3">
            <div class="flex size-8 items-center justify-center rounded-lg bg-white/20">
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
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
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              :title="t('common.close')"
              class="rounded-lg p-1.5 transition-colors hover:bg-white/10"
              @click="close"
            >
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
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
        <div class="border-border bg-surface border-t px-4 pt-1 pb-4">
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
              class="focus:ring-primary/20 focus:bg-surface focus:ring-2 bg-surface-muted w-full rounded-xl border-none py-3 pr-12 pl-4 text-sm transition-all"
            />
            <button
              :disabled="!userInput.trim() || isStreamingLoading"
              type="submit"
              class="text-primary absolute right-2 rounded-lg p-1.5 transition-all hover:bg-primary/10 disabled:opacity-30"
            >
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { API as API_URLS } from '@/utils/constants';
import { renderMarkdown } from '@/utils/ai-markdown';
import ChatMessage from '@/components/common/ai/ChatMessage.vue';
import AISuggestions from '@/components/common/ai/AISuggestions.vue';
import { useI18n } from '@/composables/useI18n';
import { useAI } from '@/composables/useAI';
import { useAIStream } from '@/composables/useAIStream';
import { useToast } from '@/composables/useToast';
import { throttle } from '@/utils/performance';

const { isOpen, close, context, setContext } = useAI();
const { t } = useI18n();
const { addToast } = useToast();
const route = useRoute();

// 从路由计算当前视图和标题
const currentView = computed(() => {
  const path = route.path;
  if (path.startsWith('/admin/')) {
    return path.replace('/admin/', '');
  }
  return 'dashboard';
});
const viewTitle = computed(() => route.meta?.title || document.title);

const userInput = ref('');
const messageContainer = ref(null);

// 自动感知上下文
watch(
  currentView,
  (view) => {
    setContext({
      path: '/' + view,
      pageTitle: viewTitle.value
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

const messages = ref([
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
}
.markdown-body p {
  margin-bottom: 0.5em;
}
.markdown-body p:last-child {
  margin-bottom: 0;
}
.markdown-body ul, .markdown-body ol {
  padding-left: 1.25em;
  margin-bottom: 0.5em;
  list-style-type: disc;
}
.markdown-body ol {
  list-style-type: decimal;
}
.markdown-body code {
  background-color: var(--bg-muted);
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: 0.9em;
}
.markdown-body pre {
  background-color: var(--color-gray-100);
  padding: 0.75em;
  border-radius: var(--radius-lg);
  overflow-x: auto;
  margin-bottom: 0.5em;
}
.markdown-body pre code {
  background-color: transparent;
  padding: 0;
  font-size: 0.85em;
}
.markdown-body strong {
  font-weight: 600;
  color: var(--text-main);
}
.markdown-body a {
  color: var(--color-info);
  text-decoration: underline;
}
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.5em;
  font-size: 0.85em;
}
.markdown-body th, .markdown-body td {
  border: 1px solid var(--border-color);
  padding: 0.4em 0.6em;
  text-align: left;
}
.markdown-body th {
  background-color: var(--bg-muted);
  font-weight: 600;
}
</style>
