<template>
  <div
    v-if="offlineReady || needRefresh"
    class="fixed bottom-4 right-4 p-4 bg-white rounded-lg shadow-lg border border-[var(--border-color)] z-[100] max-w-sm"
    role="alert"
  >
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0">
        <svg v-if="offlineReady" class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <svg v-else class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="text-sm font-medium text-gray-900">
          {{ offlineReady ? t('pwa.offlineReady') : t('pwa.newContent') }}
        </h3>
        <p class="mt-1 text-sm text-gray-500">
          {{ offlineReady ? t('pwa.offlineReadyDesc') : t('pwa.newContentDesc') }}
        </p>
        <div class="mt-3 flex gap-3">
          <button
            v-if="needRefresh"
            @click="updateServiceWorker()"
            class="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-md hover:bg-primary-hover transition-colors"
          >
            {{ t('pwa.reload') }}
          </button>
          <button
            @click="close"
            class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-[var(--bg-muted)] rounded-md hover:bg-gray-200 transition-colors"
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

const {
  offlineReady,
  needRefresh,
  updateServiceWorker,
} = useRegisterSW();

const close = async () => {
  offlineReady.value = false;
  needRefresh.value = false;
};
</script>
