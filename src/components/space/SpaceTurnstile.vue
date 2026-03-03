<template>
  <div class="flex min-h-screen items-center justify-center bg-(--bg-muted) px-4">
    <div class="w-full max-w-md">
      <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-8 text-center shadow-lg">
        <!-- Logo/Icon -->
        <div
          class="bg-primary/10 mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl"
        >
          <AppIcon name="shield-check" class="text-primary size-8" />
        </div>

        <h2 class="mb-2 text-xl font-semibold text-(--text-main)">{{ t('spacePublic.verifyHuman') }}</h2>
        <p class="mb-6 text-sm text-(--text-secondary)">{{ t('spacePublic.verifyHint') }}</p>

        <!-- Turnstile Widget Container -->
        <div class="mb-6 flex justify-center">
          <div ref="turnstileRef" class="cf-turnstile"></div>
        </div>

        <!-- Error Message -->
        <p v-if="error" class="mb-4 text-sm text-(--color-danger-text)">{{ error }}</p>

        <!-- Loading State -->
        <div v-if="verifying" class="flex items-center justify-center gap-2 text-(--text-secondary)">
          <div
            class="border-t-primary size-4 animate-spin rounded-full border-2 border-(--border-subtle)"
          ></div>
          <span class="text-sm">{{ t('spacePublic.verifying') }}</span>
        </div>
      </div>

      <!-- Footer -->
      <p class="mt-6 text-center text-xs text-(--text-secondary)">
        {{ t('spacePublic.protectedBy') }}
        <a
          href="https://www.cloudflare.com/products/turnstile/"
          target="_blank"
          class="text-primary hover:underline"
          >Cloudflare Turnstile</a
        >
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  siteKey: { type: String, required: true },
  onVerified: { type: Function, required: true },
});

const { t } = useI18n();

const turnstileRef = ref(null);
const error = ref('');
const verifying = ref(false);
let widgetId = null;

const handleCallback = async (token) => {
  verifying.value = true;
  error.value = '';

  try {
    await props.onVerified(token);
  } catch (err) {
    error.value = err.message || t('spacePublic.verifyFailed');
    // Reset widget on error
    if (window.turnstile && widgetId) {
      window.turnstile.reset(widgetId);
    }
  } finally {
    verifying.value = false;
  }
};

const handleError = () => {
  error.value = t('spacePublic.verifyFailed');
};

const initTurnstile = () => {
  if (window.turnstile && turnstileRef.value) {
    widgetId = window.turnstile.render(turnstileRef.value, {
      sitekey: props.siteKey,
      callback: handleCallback,
      'error-callback': handleError,
      theme: 'light',
      language: 'zh-cn',
    });
  }
};

onMounted(() => {
  // Check if Turnstile script is loaded
  if (window.turnstile) {
    initTurnstile();
  } else {
    // Wait for script to load
    const checkTurnstile = setInterval(() => {
      if (window.turnstile) {
        clearInterval(checkTurnstile);
        initTurnstile();
      }
    }, 100);

    // Cleanup after 10 seconds
    setTimeout(() => clearInterval(checkTurnstile), 10000);
  }
});

onUnmounted(() => {
  if (window.turnstile && widgetId) {
    window.turnstile.remove(widgetId);
  }
});
</script>
