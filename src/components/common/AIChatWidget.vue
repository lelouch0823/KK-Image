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
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']"
          >
            <div
              v-if="msg.content || msg.html"
              :class="[
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                msg.role === 'user'
                  ? 'bg-primary rounded-br-none text-white'
                  : 'border-border text-primary rounded-bl-none border bg-white'
              ]"
            >
              <div
                v-if="msg.role === 'assistant'"
                class="markdown-body text-sm leading-relaxed"
                v-html="msg.html"
              ></div>
              <p v-else class="leading-relaxed whitespace-pre-wrap">{{ msg.content }}</p>
            </div>
          </div>

          <!-- Loading / Tool Status -->
          <div v-if="loading || toolStatus" class="flex justify-start">
            <div class="border-border rounded-2xl rounded-bl-none border bg-white px-4 py-3 shadow-sm">
              <div class="flex items-center gap-3">
                <!-- Tool Status -->
                <template v-if="toolStatus">
                  <svg class="text-primary size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-secondary text-xs">{{ t('ai.toolLoading', { tool: toolStatus }) }}</span>
                </template>
                <!-- Default Thinking -->
                <template v-else>
                  <div class="flex gap-1">
                    <span class="bg-primary/40 size-1.5 animate-bounce rounded-full"></span>
                    <span class="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:0.2s]"></span>
                    <span class="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:0.4s]"></span>
                  </div>
                  <span class="text-secondary text-xs">{{ t('ai.thinking') }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="border-border border-t bg-white/50 p-4">
          <form
            class="relative flex items-center"
            @submit.prevent="sendMessage"
          >
            <input
              v-model="userInput"
              :disabled="loading"
              type="text"
              :placeholder="t('ai.placeholder')"
              class="focus:ring-primary/20 focus:bg-white focus:ring-2 w-full rounded-xl border-none bg-gray-100/50 py-3 pr-12 pl-4 text-sm transition-all"
            />
            <button
              :disabled="!userInput.trim() || loading"
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
/* global TextDecoder */
import { ref, nextTick, watch } from 'vue';
import { SSEParser } from '@/utils/streaming';
import { useSmoothTypewriter } from '@/composables/useSmoothTypewriter';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAI } from '@/composables/useAI';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 配置 marked 以支持 GFM 表格和换行
marked.use({
  gfm: true,
  breaks: true,
});

const { isOpen, close } = useAI();
const { t } = useI18n();
const { addToast } = useToast();

const loading = ref(false);
const streaming = ref(false);
const toolStatus = ref('');
const userInput = ref('');
const messageContainer = ref(null);

const { 
  displayedContent: streamContent, 
  push: bufferStream, 
  reset: resetStream 
} = useSmoothTypewriter();

// 监听流式内容更新并同步到消息列表
watch(streamContent, (newContent) => {
  if (messages.value.length > 0) {
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg.role === 'assistant') {
      lastMsg.content = newContent;
      lastMsg.html = renderMarkdown(newContent);
      scrollToBottom();
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

/**
 * 渲染 Markdown 内容为安全的 HTML
 * 包含针对 AI 输出的预处理，确保各类 Markdown 语法正确渲染
 */
function renderMarkdown(content) {
  if (!content) return '';
  
  let processed = content;

  // === 预处理 1：修复加粗/斜体标记 ===
  // AI 可能产生带空格或换行的加粗标记 (e.g. ** text ** -> **text**)
  processed = processed.replace(/\*\*\s*([\s\S]*?)\s*\*\*/g, (_, p1) => `**${p1.trim()}**`);
  processed = processed.replace(/\*\s*([^\s*][^*]*?)\s*\*/g, (_, p1) => `*${p1.trim()}*`);

  // === 预处理 2：确保块级元素前有空行 ===
  // 表格 (以 | 开头)
  processed = processed.replace(/([^\n])\n(\|)/g, '$1\n\n$2');
  
  // 有序列表 (1. Item, 2. Item, ...)
  processed = processed.replace(/([^\n])\n(\d+\.\s)/g, '$1\n\n$2');
  
  // 无序列表 (- Item 或 * Item)
  processed = processed.replace(/([^\n])\n([-*]\s)/g, '$1\n\n$2');
  
  // 标题 (# Heading)
  processed = processed.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
  
  // 代码块 (```)
  processed = processed.replace(/([^\n])\n(```)/g, '$1\n\n$2');
  
  // 引用块 (> Quote)
  processed = processed.replace(/([^\n])\n(>\s)/g, '$1\n\n$2');

  // === 预处理 3：修复列表项之间的格式 ===
  // 确保连续列表项之间只有单换行(避免变成多个独立列表)
  // 但首项仍需双换行与前文分离（已在上面处理）

  // === 预处理 4：处理中文冒号后紧跟列表的情况 ===
  // 例如 "数据如下：1. 订单" -> "数据如下：\n\n1. 订单"
  processed = processed.replace(/(：)(\d+\.\s)/g, '$1\n\n$2');
  processed = processed.replace(/(：)([-*]\s)/g, '$1\n\n$2');

  const html = marked.parse(processed);
  return DOMPurify.sanitize(html);
}

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
  if (!userInput.value.trim() || loading.value || streaming.value) return;

  const userQuery = userInput.value;
  messages.value.push({ role: 'user', content: userQuery, html: '' });
  userInput.value = '';
  loading.value = true;
  toolStatus.value = '';
  await scrollToBottom();

  // 准备发送的历史消息（不包含刚添加的用户消息的html属性）
  const historyToSend = messages.value.slice(-7).map(({ role, content }) => ({ role, content }));

  try {
    const response = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: historyToSend }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    loading.value = false;
    streaming.value = true;

    // 创建 AI 消息占位
    const aiMessageIndex = messages.value.length;
    messages.value.push({ role: 'assistant', content: '', html: '' });
    
    // 重置打字机状态
    resetStream();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SSEParser();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const events = parser.feed(chunk);
      
      for (const event of events) {
        if (event.type === 'text_delta' && event.data?.content) {
          bufferStream(event.data.content);
        } else if (event.type === 'content_block' && event.data?.content) {
          bufferStream(event.data.content);
        } else if (event.type === 'tool_call' && event.data?.name) {
          toolStatus.value = event.data.name;
        } else if (event.type === 'tool_result') {
          toolStatus.value = '';
        } else if (event.type === 'error') {
          addToast({ message: event.data?.message || t('ai.error'), type: 'error' });
        }
      }
    }

    // 最终确保渲染
    if (messages.value[aiMessageIndex].content) {
      messages.value[aiMessageIndex].html = renderMarkdown(messages.value[aiMessageIndex].content);
    } else {
      // 如果没有收到任何内容，移除空消息
      messages.value.pop();
    }

  } catch (_err) {
    addToast({ message: t('ai.networkError'), type: 'error' });
  } finally {
    loading.value = false;
    streaming.value = false;
    toolStatus.value = '';
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
