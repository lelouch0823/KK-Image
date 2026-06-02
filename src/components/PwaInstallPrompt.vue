<template>
  <Transition name="pwa-slide">
    <div
      v-if="showInstallPrompt"
      class="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-gray-200 sm:left-auto sm:right-4 sm:w-96"
    >
      <div class="flex items-start gap-3">
        <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-gray-900">安装应用</h3>
          <p class="mt-1 text-xs text-gray-500">将 KK Order 添加到主屏幕，获得更好的使用体验</p>
          <div class="mt-3 flex gap-2">
            <button
              class="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              @click="handleInstall"
            >
              安装
            </button>
            <button
              class="inline-flex items-center rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              @click="handleDismiss"
            >
              稍后再说
            </button>
          </div>
        </div>
        <button
          class="flex-shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-500"
          @click="handleDismiss"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const showInstallPrompt = ref(false);
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const DISMISS_KEY = 'pwa_install_dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 天

function isDismissed(): boolean {
  try {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) return false;
    return Date.now() - Number(dismissedAt) < DISMISS_DURATION;
  } catch {
    return false;
  }
}

function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault();
  deferredPrompt.value = e as BeforeInstallPromptEvent;

  if (!isDismissed()) {
    showInstallPrompt.value = true;
  }
}

function handleAppInstalled() {
  showInstallPrompt.value = false;
  deferredPrompt.value = null;
  try {
    localStorage.removeItem(DISMISS_KEY);
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
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
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
