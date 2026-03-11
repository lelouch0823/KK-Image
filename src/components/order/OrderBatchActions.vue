<template>
  <FloatingSelectionBar :visible="selectedCount > 0">
    <template #summary>
      <span class="text-primary text-sm font-medium">
        {{ t('order.manage.selectedCount', { count: selectedCount }) }}
      </span>
      <button
        class="hover:text-primary text-sm text-(--text-secondary) transition-colors"
        @click="$emit('cancel')"
      >
        {{ t('order.manage.cancelSelect') }}
      </button>
    </template>

    <button
      :disabled="processing"
      class="bg-primary shadow-primary/10 flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-(--text-inverse) shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
      @click="$emit('action', 'confirm')"
    >
      <AppIcon name="check" class="size-4.5" />
      {{ t('order.manage.batchConfirm') }}
    </button>
    <button
      :disabled="processing"
      class="bg-warning shadow-warning/10 flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-(--text-inverse) shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
      @click="$emit('action', 'reject')"
    >
      <AppIcon name="x-mark" class="size-4.5" />
      {{ t('order.manage.batchReject') }}
    </button>
    <button
      :disabled="processing"
      class="bg-danger shadow-danger/10 flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-(--text-inverse) shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
      @click="$emit('action', 'void')"
    >
      <AppIcon name="trash" class="size-4" />
      {{ t('order.manage.batchVoid') }}
    </button>
  </FloatingSelectionBar>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';
import FloatingSelectionBar from '@/design-system/composed/FloatingSelectionBar.vue';

defineProps({
  selectedCount: {
    type: Number,
    default: 0,
  },
  processing: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['action', 'cancel']);

const { t } = useI18n();
</script>
