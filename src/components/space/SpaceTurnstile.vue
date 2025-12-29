<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--bg-muted)] px-4">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-2xl shadow-lg p-8 text-center">
        <!-- Logo/Icon -->
        <div class="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-2xl flex items-center justify-center">
          <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        </div>
        
        <h2 class="text-xl font-semibold text-primary mb-2">{{ t('spacePublic.verifyHuman') }}</h2>
        <p class="text-sm text-secondary mb-6">{{ t('spacePublic.verifyHint') }}</p>
        
        <!-- Turnstile Widget Container -->
        <div class="flex justify-center mb-6">
          <div ref="turnstileRef" class="cf-turnstile"></div>
        </div>
        
        <!-- Error Message -->
        <p v-if="error" class="text-sm text-[var(--color-danger)] mb-4">{{ error }}</p>
        
        <!-- Loading State -->
        <div v-if="verifying" class="flex items-center justify-center gap-2 text-secondary">
          <div class="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
          <span class="text-sm">{{ t('spacePublic.verifying') }}</span>
        </div>
      </div>
      
      <!-- Footer -->
      <p class="text-center text-xs text-secondary mt-6">
        {{ t('spacePublic.protectedBy') }}
        <a href="https://www.cloudflare.com/products/turnstile/" target="_blank" 
           class="text-primary hover:underline">Cloudflare Turnstile</a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  siteKey: { type: String, required: true },
  onVerified: { type: Function, required: true }
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
      language: 'zh-cn'
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
