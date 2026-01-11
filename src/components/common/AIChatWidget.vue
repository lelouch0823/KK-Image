<template>
  <div class="pointer-events-none fixed right-6 bottom-6 z-50">
    <!-- Chat Window -->
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
        class="bg-card/80 border-border pointer-events-auto absolute right-0 bottom-0 flex h-[600px] w-[420px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl"
      >
        <!-- Header -->
        <div class="bg-primary flex items-center justify-between p-4 text-white">
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
          <!-- Message Loop -->
          <ChatMessage
            v-for="(msg, index) in messages"
            :key="index"
            :message="msg"
            :is-thinking="index === messages.length - 1 && isThinking"
            :tool-status="index === messages.length - 1 ? toolStatus : ''"
          />
        </div>

        <!-- Input Area -->
        <div class="border-border border-t bg-white/50 px-4 pt-1 pb-4">
          <!-- Proactive Suggestions -->
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
              class="focus:ring-primary/20 focus:bg-white focus:ring-2 w-full rounded-xl border-none bg-gray-100/50 py-3 pr-12 pl-4 text-sm transition-all"
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
import { renderMarkdown } from '@/utils/ai-markdown';
import ChatMessage from '@/components/common/ai/ChatMessage.vue';
import AISuggestions from '@/components/common/ai/AISuggestions.vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAI } from '@/composables/useAI';
import { useAIStream } from '@/composables/useAIStream';

/**
 * 核心节流函数 - 提升 Markdown 渲染性能
 * @param {Function} fn - 需要执行的函数
 * @param {number} wait - 节流间隔（毫秒）
 */
function throttle(fn, wait) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= wait) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}

const { isOpen, close, context, setContext } = useAI();
const { t } = useI18n();
const { addToast } = useToast();
const route = useRoute();

const userInput = ref('');
const messageContainer = ref(null);

// 自动感知上下文
watch(
  () => route.path,
  () => {
    setContext({
      path: route.path,
      pageTitle: route.meta?.title || document.title
    });
  },
  { immediate: true }
);

// 主动建议逻辑
const suggestions = computed(() => {
  const path = route.path;
  const sug = (key) => t(`ai.suggestions.${key}`);
  
  if (path === '/' || path === '/dashboard') {
    return [sug('dailyReport'), sug('monthlySalesRanking'), sug('systemStatus')];
  }
  if (path.startsWith('/orders')) {
    return [sug('pendingOrders'), sug('todayNewOrders'), sug('weeklySalesTrend')];
  }
  if (path.startsWith('/customers')) {
    return [sug('weeklyNewCustomers'), sug('customerCount')];
  }
  if (path.startsWith('/manage/spaces')) {
    return [sug('spaceUsage'), sug('recentActiveSpaces'), sug('downloadTop10')];
  }
  if (path.startsWith('/manage/files')) {
    return [sug('storageUsage'), sug('largeFileAnalysis'), sug('fileTypeDistribution')];
  }
  if (path.startsWith('/sales')) {
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
  displayedContent: streamContent, 
  isThinking,
  isLoading: isStreamingLoading,
  isStreaming: isAIStreaming,
  toolStatus,
  resetStream 
} = useAIStream();

// SOTA: Throttled Markdown rendering
// AI typing speed is fast (~60fps), rendering Markdown on every char is expensive.
// We throttle it to ~10fps (100ms) which is visually indistinguishable but saves ~80% CPU.
const throttledRender = throttle((content, targetMsg) => {
  if (targetMsg) {
    targetMsg.html = renderMarkdown(content);
    scrollToBottom();
  }
}, 100);

// Listen for streaming content updates
watch(streamContent, (newContent) => {
  if (messages.value.length > 0) {
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg.role === 'assistant') {
      lastMsg.content = newContent;
      // Use throttled renderer
      throttledRender(newContent, lastMsg);
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

// Auto scroll when opened
watch(isOpen, (val) => {
  if (val) {
    scrollToBottom();
  }
});

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
  loading.value = true;
  toolStatus.value = '';
  await scrollToBottom();

  // 准备发送的历史消息（不包含刚添加的用户消息的html属性）
  const historyToSend = messages.value.slice(-7).map(({ role, content }) => ({ role, content }));

  try {
    // 1. 发起流式请求
    await startAIStream({
      messages: historyToSend,
      context: context.value,
      onChart: (chartData) => {
        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg) {
          if (!lastMsg.charts) lastMsg.charts = [];
          lastMsg.charts.push(chartData);
          scrollToBottom();
        }
      }
    });

    // 2. 流结束后的最终渲染 (确保最后一块内容被正确渲染，不依赖 throttle)
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      lastMsg.html = renderMarkdown(lastMsg.content);
      if (!lastMsg.content && (!lastMsg.charts || lastMsg.charts.length === 0)) {
        messages.value.pop(); // 移除空消息
      }
    }
  } catch (_err) {
    // Error is handled in useAIStream (toast)
  } finally {
    await scrollToBottom();
  }
};
</script>

<style>
/* Markdown Styles - Using Design Tokens */
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
