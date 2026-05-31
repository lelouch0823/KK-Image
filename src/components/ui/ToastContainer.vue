<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed top-4 right-4 z-[1000] flex flex-col gap-2" aria-live="polite" aria-atomic="false">
      <transition-group name="toast-slide">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex w-full max-w-xs items-center rounded-xl border border-(--border-color) bg-(--bg-card)/95 p-3.5 shadow-lg backdrop-blur-sm"
          :role="toast.type === 'error' ? 'alert' : 'status'"
        >
          <div
            class="inline-flex size-8 flex-shrink-0 items-center justify-center rounded-lg"
            :class="{
              'bg-(--color-success-bg) text-(--color-success-text)':
                toast.type === 'success',
              'bg-(--color-danger-bg) text-(--color-danger-text)': toast.type === 'error',
              'bg-(--color-warning-bg) text-(--color-warning-text)':
                toast.type === 'warning',
              'bg-(--color-info-bg) text-(--color-info-text)':
                toast.type === 'info',
            }"
          >
            <!-- Success Icon -->
            <AppIcon
              v-if="toast.type === 'success'"
              name="check-circle-solid"
              class="size-5"
            />
            <!-- Error Icon -->
            <AppIcon
              v-else-if="toast.type === 'error'"
              name="x-circle-solid"
              class="size-5"
            />
            <!-- Warning Icon (Exclamation) -->
            <AppIcon
              v-else-if="toast.type === 'warning'"
              name="exclamation-triangle-solid"
              class="size-5"
            />
            <!-- Info Icon -->
            <AppIcon
              v-else-if="toast.type === 'info'"
              name="information-circle"
              class="size-5"
            />
          </div>
          <div class="ml-3 text-sm font-normal text-(--text-main)">{{ toast.message }}</div>
          <button
            type="button"
            class="-m-1 ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-transparent text-(--text-muted) transition-colors hover:bg-(--bg-hover) hover:text-(--text-main)"
            @click="removeToast(toast.id)"
          >
            <span class="sr-only">{{ t('common.close') }}</span>
            <AppIcon name="x-mark" class="size-5" />
          </button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

const { toasts, removeToast } = useToast();
const { t } = useI18n();
</script>

<style scoped>
.toast-slide-enter-active {
  transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-slide-leave-active {
  transition: all 200ms ease-in;
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.toast-slide-move {
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
