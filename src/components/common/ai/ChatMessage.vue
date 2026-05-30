<template>
  <div>
    <!-- Message Bubble -->
    <div :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']">
      <div
        v-if="message.content || message.html || isThinking || toolStatus"
        :class="[
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-card transition-all',
          message.role === 'user'
            ? 'bg-primary shadow-primary/20 rounded-br-none font-medium text-(--text-inverse)'
            : 'rounded-bl-none border border-(--border-color) bg-(--bg-card) text-(--text-main) shadow-card',
        ]"
      >
        <!-- Assistant Message (Markdown) -->
        <div
          v-if="message.role === 'assistant' && message.html"
          class="markdown-body text-sm leading-relaxed"
          v-html="message.html"
        ></div>

        <!-- User Message (Multimodal) -->
        <div v-else-if="message.role === 'user'" class="space-y-2 leading-relaxed">
          <template v-for="(part, index) in userMessageParts" :key="index">
            <p v-if="part.type === 'text'" class="whitespace-pre-wrap">{{ part.text }}</p>
            <img
              v-else-if="part.type === 'image_url' && part.image_url?.url"
              :src="part.image_url.url"
              alt="User attached image"
              class="max-h-48 max-w-full rounded-lg border border-(--text-inverse)/30 object-contain shadow-sm"
            />
          </template>
        </div>

        <!-- Thinking / Tool Status (Integrated) -->
        <div
          v-if="message.role === 'assistant' && (isThinking || toolStatus)"
          class="flex items-center gap-3"
          :class="message.html ? 'mt-3 border-t border-(--border-color)/50 pt-3' : ''"
        >
          <!-- Tool Status -->
          <template v-if="toolStatus">
            <AppIcon name="spinner" class="text-primary size-4 animate-spin" />
            <span class="text-secondary text-xs">{{
              t('ai.toolLoading', { tool: getToolName(toolStatus) })
            }}</span>
          </template>
          <!-- Default Thinking -->
          <template v-else>
            <div class="flex gap-1">
              <span class="bg-primary/40 size-1.5 animate-bounce rounded-full"></span>
              <span
                class="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:0.2s]"
              ></span>
              <span
                class="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:0.4s]"
              ></span>
            </div>
            <span v-if="!message.html" class="text-secondary text-xs">{{ t('ai.thinking') }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- Report Button (below this specific message bubble with marker) -->
    <transition
      enter-active-class="transition-all duration-500 ease-out-expo"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div v-if="showReportButton && !isGeneratingReport" class="mt-2 flex justify-start">
        <AppButton
          variant="white"
          class="!rounded-xl border-info/20 bg-(--color-info-bg) text-(--color-info-text) shadow-sm hover:!bg-(--color-info-bg) hover:opacity-90"
          @click="$emit('generate-report')"
        >
          <template #icon-left>
            <AppIcon name="chart-bar" class="size-4" />
          </template>
          {{ t('ai.generateReport') }}
        </AppButton>
      </div>
    </transition>

    <!-- Report Generation Loading -->
    <div v-if="isGeneratingReport" class="mt-2 flex justify-start">
      <div
        class="flex items-center gap-2 rounded-xl bg-(--bg-muted) px-4 py-2.5 text-sm text-(--text-secondary)"
      >
        <AppIcon name="spinner" class="size-4 animate-spin" />
        {{ t('ai.generatingReport') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps({
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
  },
});

defineEmits(['generate-report']);

const userMessageParts = computed(() => {
  const content = props.message?.content;
  if (Array.isArray(content)) {
    return content.filter((part) => {
      if (part?.type === 'text' && typeof part.text === 'string') return true;
      if (part?.type === 'image_url' && typeof part.image_url?.url === 'string') return true;
      return false;
    });
  }
  if (typeof content === 'string' && content.trim()) {
    return [{ type: 'text', text: content }];
  }
  return [];
});

const getToolName = (status) => {
  if (!status) return '';
  return t(`ai.toolNames.${status}`, status);
};
</script>
