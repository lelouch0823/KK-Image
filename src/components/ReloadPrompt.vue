<template>
  <div
    v-if="offlineReady || needRefresh"
    class="fixed right-4 bottom-4 z-[100] max-w-sm rounded-2xl border border-(--border-color) bg-(--bg-card) p-4 shadow-lg"
    role="alert"
  >
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0">
        <AppIcon v-if="offlineReady" name="check-circle" class="size-6 text-success" />
        <AppIcon v-else name="arrow-path" class="size-6 text-primary" />
      </div>
      <div class="flex-1">
        <h3 class="text-primary text-sm font-medium">
          {{ offlineReady ? t('pwa.offlineReady') : t('pwa.newContent') }}
        </h3>
        <p class="text-secondary mt-1 text-sm">
          {{ offlineReady ? t('pwa.offlineReadyDesc') : t('pwa.newContentDesc') }}
        </p>
        <div class="mt-3 flex gap-3">
          <AppButton
            v-if="needRefresh"
            size="sm"
            :text="t('pwa.reload')"
            @click="updateServiceWorker()"
          />
          <AppButton variant="secondary" size="sm" :text="t('pwa.close')" @click="close" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { t } = useI18n();
let offlineReady = ref(false);
let needRefresh = ref(false);
let updateServiceWorker = async () => {};

if (import.meta.env.PROD) {
  ({ offlineReady, needRefresh, updateServiceWorker } = useRegisterSW());
}

const close = async () => {
  offlineReady.value = false;
  needRefresh.value = false;
};
</script>
