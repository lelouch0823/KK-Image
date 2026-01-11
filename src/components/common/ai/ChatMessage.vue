<template>
  <div :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']">
    <div
      v-if="message.content || message.html"
      :class="[
        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-all',
        message.role === 'user'
          ? 'bg-primary rounded-br-none text-white'
          : 'border-border text-primary rounded-bl-none border bg-white'
      ]"
    >
      <!-- Assistant Message (Markdown) -->
      <div
        v-if="message.role === 'assistant'"
        class="markdown-body text-sm leading-relaxed"
        v-html="message.html"
      ></div>
      
      <!-- User Message (Plain Text) -->
      <p v-else class="leading-relaxed whitespace-pre-wrap">{{ message.content }}</p>
    </div>

    <!-- Generative Charts (Rendered below the text bubble) -->
    <div v-if="message.charts && message.charts.length > 0" class="mt-4 flex w-full max-w-[85%] flex-col gap-4">
      <AIChart
        v-for="(chart, idx) in message.charts"
        :key="idx"
        :type="chart.type || 'bar'"
        :data="chart.data"
        :title="chart.title"
        :options="chart.options"
      />
    </div>
  </div>

  <!-- Thinking / Tool Status for Assistant (Only shown when this is the latest responding message) -->
  <div v-if="isThinking || toolStatus" class="flex justify-start">
    <div class="border-border rounded-2xl rounded-bl-none border bg-white px-4 py-3 shadow-sm">
      <div class="flex items-center gap-3">
        <!-- Tool Status -->
        <template v-if="toolStatus">
          <svg class="text-primary size-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-secondary text-xs">{{ t('ai.toolLoading', { tool: getToolName(toolStatus) }) }}</span>
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
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AIChart from './AIChart.vue';

const { t } = useI18n();

defineProps({
  message: {
    type: Object,
    required: true,
  },
  // 下面这些属性只对应最新的一条助手消息
  isThinking: {
    type: Boolean,
    default: false,
  },
  toolStatus: {
    type: String,
    default: '',
  }
});

const getToolName = (status) => {
  if (!status) return '';
  return t(`ai.toolNames.${status}`, status);
};
</script>
