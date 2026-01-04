<template>
  <div class="fixed right-6 bottom-6 z-50 pointer-events-none">
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
        class="bg-card/80 border-border absolute right-0 bottom-0 flex h-[600px] w-[420px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl pointer-events-auto"
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
          <button
            class="rounded-lg p-1.5 transition-colors hover:bg-white/10"
            @click="close"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
              <p class="leading-relaxed whitespace-pre-wrap">{{ msg.content }}</p>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="flex justify-start">
            <div class="border-border rounded-2xl rounded-bl-none border bg-white px-4 py-3 shadow-sm">
              <div class="flex gap-1">
                <span class="bg-primary/40 size-1.5 animate-bounce rounded-full"></span>
                <span class="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:0.2s]"></span>
                <span class="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:0.4s]"></span>
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
import { ref, nextTick, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAI } from '@/composables/useAI';

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
