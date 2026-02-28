<template>
  <div class="overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card)">
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
