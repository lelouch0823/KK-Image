<template>
  <div
    v-if="offlineReady || needRefresh"
    class="fixed right-4 bottom-4 z-[100] max-w-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-lg"
    role="alert"
  >
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0">
        <svg
          v-if="offlineReady"
          class="size-6 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <svg
          v-else
          class="text-primary size-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="text-primary text-sm font-medium">
          {{ offlineReady ? t('pwa.offlineReady') : t('pwa.newContent') }}
        </h3>
        <p class="text-secondary mt-1 text-sm">
          {{ offlineReady ? t('pwa.offlineReadyDesc') : t('pwa.newContentDesc') }}
        </p>
        <div class="mt-3 flex gap-3">
          <button
            v-if="needRefresh"
            class="bg-primary rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover dark:text-gray-900"
            @click="updateServiceWorker()"
          >
            {{ t('pwa.reload') }}
          </button>
          <button
            class="rounded-md bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
            @click="close"
          >
            {{ t('pwa.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW();

const close = async () => {
  offlineReady.value = false;
  needRefresh.value = false;
};
</script>
