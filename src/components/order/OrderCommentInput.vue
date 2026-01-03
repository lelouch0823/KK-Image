<template>
  <div class="overflow-hidden rounded-xl border border-[var(--border-color)] bg-white">
    <div class="flex items-center gap-3 p-3">
      <input
        v-model="text"
        type="text"
        :placeholder="t('order.detail.commentPlaceholder')"
        class="focus:ring-primary/20 h-10 flex-1 rounded-full border-0 bg-[var(--bg-muted)] px-4 text-sm transition-all focus:ring-2 focus:outline-none"
        @keyup.enter="send"
      />
      <button
        :disabled="!text.trim() || loading"
        class="bg-primary shadow-primary/20 flex size-10 flex-shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-all hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        @click="send"
      >
        <svg v-if="!loading" class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
        <svg v-else class="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit']);

const { t } = useI18n();
const text = ref('');

const send = () => {
  if (!text.value.trim()) return;
  emit('submit', text.value.trim());
  text.value = '';
};
</script>
