<template>
  <Transition name="pwa-slide">
    <div
      v-if="showInstallPrompt"
      class="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-(--bg-card) p-4 shadow-2xl ring-1 ring-(--border-color) sm:left-auto sm:right-4 sm:w-96"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-(--color-primary-bg)"
        >
          <AppIcon name="phone" class="h-6 w-6 text-primary" />
        </div>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-(--text-main)">{{ t('pwa.installTitle') }}</h3>
          <p class="mt-1 text-xs text-(--text-muted)">{{ t('pwa.installDescription') }}</p>
          <div class="mt-3 flex gap-2">
            <AppButton variant="primary" size="sm" @click="handleInstall">
              {{ t('pwa.install') }}
            </AppButton>
            <AppButton variant="secondary" size="sm" @click="handleDismiss">
              {{ t('pwa.dismiss') }}
            </AppButton>
          </div>
        </div>
        <AppButton
          variant="ghost"
          size="sm"
          :aria-label="t('pwa.dismiss')"
          class="!h-8 !w-8 !gap-0 !px-0 [&_span]:hidden"
          @click="handleDismiss"
        >
          <template #icon-left>
            <AppIcon name="x-mark" class="size-4" />
          </template>
        </AppButton>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getItem, setItem, removeItem } from '@/utils/storage';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { t } = useI18n();

const showInstallPrompt = ref(false);
const deferredPrompt = ref(null);
const DISMISS_KEY = 'pwa_install_dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 天

function isDismissed() {
  try {
    const dismissedAt = getItem(DISMISS_KEY);
    if (!dismissedAt) return false;
    return Date.now() - Number(dismissedAt) < DISMISS_DURATION;
  } catch {
    return false;
  }
}

function handleBeforeInstallPrompt(e) {
  e.preventDefault();
  deferredPrompt.value = e;

  if (!isDismissed()) {
    showInstallPrompt.value = true;
  }
}

function handleAppInstalled() {
  showInstallPrompt.value = false;
  deferredPrompt.value = null;
  try {
    removeItem(DISMISS_KEY);
  } catch {
    // ignore
  }
}

async function handleInstall() {
  const prompt = deferredPrompt.value;
  if (!prompt) return;

  showInstallPrompt.value = false;

  try {
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'dismissed') {
      handleDismiss();
    }
  } catch {
    // 用户取消或浏览器不支持
  }

  deferredPrompt.value = null;
}

function handleDismiss() {
  showInstallPrompt.value = false;
  try {
    setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
});

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.removeEventListener('appinstalled', handleAppInstalled);
});
</script>

<style scoped>
.pwa-slide-enter-active,
.pwa-slide-leave-active {
  transition: all 0.3s ease;
}

.pwa-slide-enter-from,
.pwa-slide-leave-to {
  opacity: 0;
  transform: translateY(1rem);
}
</style>
