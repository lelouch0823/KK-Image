<template>
  <div class="overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) shadow-card">
    <div
      v-if="error"
      class="border-b border-(--color-danger-text)/20 bg-(--color-danger-bg)/40 px-3 py-2"
      data-testid="comment-error"
    >
      <p class="text-xs text-(--text-main)">{{ error }}</p>
    </div>
    <div class="flex items-center gap-3 p-3">
      <AppInput
        v-model="text"
        :placeholder="t('order.detail.commentPlaceholder')"
        class="!h-10 !flex-1 !rounded-full !border-0 !bg-(--bg-muted) !px-4"
        @keyup.enter="send"
      />
      <AppButton
        variant="primary"
        size="sm"
        :disabled="!text.trim() || loading"
        :loading="loading"
        class="shadow-primary/20 !size-10 shrink-0 rounded-full !gap-0 !px-0 shadow-lg [&_span]:hidden"
        @click="send"
      >
        <template #icon-left>
          <AppIcon name="paper-airplane" class="size-5" />
        </template>
      </AppButton>
    </div>
    <div v-if="error && text.trim()" class="px-3 pb-3">
      <AppButton
        variant="primary"
        size="sm"
        data-testid="comment-retry"
        @click="retry"
      >
        {{ t('common.retry') }}
      </AppButton>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';

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
