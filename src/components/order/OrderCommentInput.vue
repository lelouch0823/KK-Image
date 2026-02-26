<template>
  <div class="border-(--border-color) bg-(--bg-card) overflow-hidden rounded-xl border">
    <div class="flex items-center gap-3 p-3">
      <input
        v-model="text"
        type="text"
        :placeholder="t('order.detail.commentPlaceholder')"
        class="bg-(--bg-muted) text-(--text-main) h-10 flex-1 rounded-full border-0 px-4 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none"
        @keyup.enter="send"
      />
      <button
        :disabled="!text.trim() || loading"
        class="bg-primary text-(--text-inverse) shadow-primary/20 flex size-10 shrink-0 items-center justify-center rounded-full shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        @click="send"
      >
        <AppIcon v-if="!loading" name="paper-airplane" class="size-5" />
        <AppIcon v-else name="spinner" class="size-5 animate-spin" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

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
