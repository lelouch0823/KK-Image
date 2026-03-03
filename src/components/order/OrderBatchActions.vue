<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="transform translate-y-4 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-4 opacity-0"
  >
    <div
      v-if="selectedCount > 0"
      class="sticky right-0 bottom-0 left-0 z-20 flex items-center justify-between gap-4 border-t border-(--border-color) bg-(--bg-card) bg-(--bg-card)/90 px-4 py-3.5 shadow-xl shadow-black/10 backdrop-blur-md"
    >
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-primary">
          {{ t('order.manage.selectedCount', { count: selectedCount }) }}
        </span>
        <button
          class="text-sm text-(--text-secondary) transition-colors hover:text-primary"
          @click="$emit('cancel')"
        >
          {{ t('order.manage.cancelSelect') }}
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button
          :disabled="processing"
          class="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-(--text-inverse) shadow-primary/10 shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          @click="$emit('action', 'confirm')"
        >
          <AppIcon name="check" class="size-4.5" />
          {{ t('order.manage.batchConfirm') }}
        </button>
        <button
          :disabled="processing"
          class="flex h-9 items-center gap-1.5 rounded-xl bg-warning px-4 text-sm font-bold text-(--text-inverse) shadow-warning/10 shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          @click="$emit('action', 'reject')"
        >
          <AppIcon name="x-mark" class="size-4.5" />
          {{ t('order.manage.batchReject') }}
        </button>
        <button
          :disabled="processing"
          class="flex h-9 items-center gap-1.5 rounded-xl bg-danger px-4 text-sm font-bold text-(--text-inverse) shadow-danger/10 shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          @click="$emit('action', 'void')"
        >
          <AppIcon name="trash" class="size-4" />
          {{ t('order.manage.batchVoid') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

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
