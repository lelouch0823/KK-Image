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
                v-html="renderMarkdown(msg.content)"
              ></div>
              <p v-else class="leading-relaxed whitespace-pre-wrap">{{ msg.content }}</p>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="flex justify-start">
            <div class="border-border rounded-2xl rounded-bl-none border bg-white px-4 py-3 shadow-sm">
              <div class="flex items-center gap-3">
                <div class="flex gap-1">
                  <span class="bg-primary/40 size-1.5 animate-bounce rounded-full"></span>
                  <span class="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:0.2s]"></span>
                  <span class="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:0.4s]"></span>
                </div>
                <span class="text-secondary text-xs">{{ t('ai.thinking') }}</span>
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
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAI } from '@/composables/useAI';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const { isOpen, close } = useAI();
const { t } = useI18n();
const { addToast } = useToast();

const loading = ref(false);
const userInput = ref('');
const messageContainer = ref(null);

const messages = ref([
  { role: 'assistant', content: t('ai.welcome') }
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

const renderMarkdown = (content) => {
  if (!content) return '';
  const html = marked.parse(content);
  return DOMPurify.sanitize(html);
};

const clearHistory = () => {
  if (confirm(t('ai.clearConfirm'))) {
    messages.value = [
      { role: 'assistant', content: t('ai.welcome') }
    ];
  }
};

const sendMessage = async () => {
  if (!userInput.value.trim() || loading.value) return;

  const userQuery = userInput.value;
  messages.value.push({ role: 'user', content: userQuery });
  userInput.value = '';
  loading.value = true;
  await scrollToBottom();

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: messages.value.slice(-6) // 只带最近几轮对话
      }),
    });

    const result = await res.json();
    if (result.success) {
      messages.value.push(result.data.message);
    } else {
      addToast({ message: result.message || t('ai.error'), type: 'error' });
    }
  } catch (err) {
    addToast({ message: t('ai.networkError'), type: 'error' });
    console.error(err);
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
};
</script>

<style>
/* Markdown Styles */
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
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
}
.markdown-body pre {
  background-color: #f3f4f6;
  padding: 0.75em;
  border-radius: 8px;
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
  color: #111827;
}
.markdown-body a {
  color: #2563eb;
  text-decoration: underline;
}
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.5em;
  font-size: 0.85em;
}
.markdown-body th, .markdown-body td {
  border: 1px solid #e5e7eb;
  padding: 0.4em 0.6em;
  text-align: left;
}
.markdown-body th {
  background-color: #f9fafb;
  font-weight: 600;
}
</style>
