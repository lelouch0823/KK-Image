<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed top-4 right-4 z-[1000] flex flex-col gap-2">
      <transition-group name="toast-slide">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="shadow-soft pointer-events-auto flex w-full max-w-xs items-center rounded-lg border border-(--border-color) bg-(--bg-card)/95 p-4 backdrop-blur-sm"
          role="alert"
        >
          <div
            class="inline-flex size-8 flex-shrink-0 items-center justify-center rounded-lg"
            :class="{
              'bg-(--color-success-bg) text-(--color-success-text)':
                toast.type === 'success',
              'bg-(--color-danger-bg) text-(--color-danger-text)': toast.type === 'error',
              'bg-(--color-warning-bg) text-(--color-warning-text)':
                toast.type === 'warning',
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
          </div>
          <div class="ml-3 text-sm font-normal text-(--text-main)">{{ toast.message }}</div>
          <button
            type="button"
            class="-m-1.5 ml-auto inline-flex size-8 rounded-lg bg-transparent p-1.5 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-main) focus:ring-2 focus:ring-(--border-color)"
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
