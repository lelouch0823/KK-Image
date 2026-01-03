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
      class="sticky right-0 bottom-0 left-0 z-20 flex items-center justify-between gap-4 border-t border-[var(--border-color)] bg-[var(--bg-card)] bg-[var(--bg-card)]/90 px-4 py-3.5 shadow-xl shadow-black/10 backdrop-blur-md"
    >
      <div class="flex items-center gap-3">
        <span class="text-primary text-sm font-medium">
          {{ t('order.manage.selectedCount', { count: selectedCount }) }}
        </span>
        <button
          class="text-secondary text-sm transition-colors hover:text-primary"
          @click="$emit('cancel')"
        >
          {{ t('order.manage.cancelSelect') }}
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button
          :disabled="processing"
          class="flex h-9 items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white shadow-[var(--color-primary)]/10 shadow-lg transition-all hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:opacity-50"
          @click="$emit('action', 'confirm')"
        >
          <svg class="size-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          {{ t('order.manage.batchConfirm') }}
        </button>
        <button
          :disabled="processing"
          class="flex h-9 items-center gap-1.5 rounded-xl bg-[var(--color-warning)] px-4 text-sm font-bold text-white shadow-[var(--color-warning)]/10 shadow-lg transition-all hover:bg-[var(--color-warning)]/90 active:scale-95 disabled:opacity-50"
          @click="$emit('action', 'reject')"
        >
          <svg class="size-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          {{ t('order.manage.batchReject') }}
        </button>
        <button
          :disabled="processing"
          class="flex h-9 items-center gap-1.5 rounded-xl bg-[var(--color-danger)] px-4 text-sm font-bold text-white shadow-[var(--color-danger)]/10 shadow-lg transition-all hover:bg-[var(--color-danger)]/90 active:scale-95 disabled:opacity-50"
          @click="$emit('action', 'void')"
        >
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          {{ t('order.manage.batchVoid') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';

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
