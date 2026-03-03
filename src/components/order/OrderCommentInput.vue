<template>
  <div class="overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card)">
    <div
      v-if="error"
      class="border-b border-(--color-danger-text)/20 bg-(--color-danger-bg)/40 px-3 py-2"
      data-testid="comment-error"
    >
      <p class="text-xs text-(--text-main)">{{ error }}</p>
    </div>
    <div class="flex items-center gap-3 p-3">
      <input
        v-model="text"
        type="text"
        :placeholder="t('order.detail.commentPlaceholder')"
        class="focus:ring-primary/20 focus:ring-2 focus:outline-none h-10 flex-1 rounded-full border-0 bg-(--bg-muted) px-4 text-sm text-(--text-main) transition-all"
        @keyup.enter="send"
      />
      <button
        :disabled="!text.trim() || loading"
        class="bg-primary shadow-primary/20 flex size-10 shrink-0 items-center justify-center rounded-full text-(--text-inverse) shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        @click="send"
      >
        <AppIcon v-if="!loading" name="paper-airplane" class="size-5" />
        <AppIcon v-else name="spinner" class="size-5 animate-spin" />
      </button>
    </div>
    <div v-if="error && text.trim()" class="px-3 pb-3">
      <button
        type="button"
        class="bg-primary rounded-lg px-3 py-1.5 text-xs font-medium text-(--text-inverse)"
        data-testid="comment-retry"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  pendingComment: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['submit', 'retry']);

const { t } = useI18n();
const text = ref('');

const send = () => {
  if (!text.value.trim()) return;
  emit('submit', text.value.trim());
};

const retry = () => {
  if (!text.value.trim()) return;
  emit('retry', text.value.trim());
};

const clear = () => {
  text.value = '';
};

const setText = (value) => {
  text.value = String(value || '');
};

const getText = () => text.value.trim();

watch(
  () => props.pendingComment,
  (value) => {
    if (value && !text.value.trim()) {
      text.value = value;
    }
  },
  { immediate: true }
);

defineExpose({ clear, setText, getText });
</script>
