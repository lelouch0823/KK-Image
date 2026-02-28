<template>
  <div>
    <!-- Message Bubble -->
    <div :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']">
      <div
        v-if="message.content || message.html"
        :class="[
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-all',
          message.role === 'user'
            ? 'bg-primary shadow-primary/20 rounded-br-none font-medium text-(--text-inverse)'
            : 'rounded-bl-none border border-(--border-color) bg-(--bg-card) text-(--text-main) shadow-sm'
        ]"
      >
        <!-- Assistant Message (Markdown) -->
        <div
          v-if="message.role === 'assistant' && message.html"
          class="markdown-body text-sm leading-relaxed"
          v-html="message.html"
        ></div>
        
        <!-- User Message (Plain Text) -->
        <p v-else-if="message.role === 'user'" class="leading-relaxed whitespace-pre-wrap">{{ message.content }}</p>
      </div>
    </div>

    <!-- Report Button (below this specific message bubble with marker) -->
    <transition
      enter-active-class="transition-all duration-500 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div v-if="showReportButton && !isGeneratingReport" class="mt-2 flex justify-start">
        <button
          class="from-info to-purple flex items-center gap-2 rounded-xl bg-gradient-to-r px-4 py-2.5 text-sm font-medium text-(--text-inverse) shadow-md transition-all hover:shadow-lg hover:brightness-110"
          @click="$emit('generate-report')"
        >
          <AppIcon name="chart-bar" class="size-4" />
          {{ t('ai.generateReport') }}
        </button>
      </div>
    </transition>

    <!-- Report Generation Loading -->
    <div v-if="isGeneratingReport" class="mt-2 flex justify-start">
      <div class="flex items-center gap-2 rounded-xl bg-(--bg-muted) px-4 py-2.5 text-sm text-(--text-secondary)">
        <AppIcon name="spinner" class="size-4 animate-spin" />
        {{ t('ai.generatingReport') }}
      </div>
    </div>

    <!-- Thinking / Tool Status for Assistant -->
    <div v-if="isThinking || toolStatus" class="flex justify-start">
      <div class="rounded-2xl rounded-bl-none border border-(--border-color) bg-(--bg-card) px-4 py-3 shadow-sm">
        <div class="flex items-center gap-3">
          <!-- Tool Status -->
          <template v-if="toolStatus">
            <AppIcon name="spinner" class="text-primary size-4 animate-spin" />
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
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

defineProps({
  message: {
    type: Object,
    required: true,
  },
  isThinking: {
    type: Boolean,
    default: false,
  },
  toolStatus: {
    type: String,
    default: '',
  },
  showReportButton: {
    type: Boolean,
    default: false,
  },
  isGeneratingReport: {
    type: Boolean,
    default: false,
  }
});

defineEmits(['generate-report']);

const getToolName = (status) => {
  if (!status) return '';
  return t(`ai.toolNames.${status}`, status);
};
</script>
