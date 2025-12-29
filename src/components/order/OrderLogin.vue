<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="w-full max-w-sm">
      <!-- Logo 和标题 -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary to-gray-700 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-primary">{{ t('order.portal.loginTitle') }}</h1>
        <p class="text-sm text-secondary mt-1">{{ t('order.portal.loginSubtitle') }}</p>
      </div>

      <!-- 登录表单 -->
      <div class="bg-white rounded-2xl border border-[var(--border-color)] shadow-xl p-6">
        <form @submit.prevent="handleSubmit">
          <!-- 密码输入 -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-primary mb-2">
              {{ t('auth.password') }}
            </label>
            <div class="relative">
              <input 
                v-model="password" 
                :type="showPassword ? 'text' : 'password'" 
                :placeholder="t('auth.passwordPlaceholder')"
                autocomplete="current-password"
                class="w-full h-12 px-4 pr-12 text-sm border border-[var(--border-color)] rounded-xl bg-[var(--bg-muted)] focus:bg-white focus:border-primary focus:outline-none transition-all"
              >
              <button 
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-secondary hover:text-primary transition-colors"
              >
                <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- 记住我 -->
          <label class="flex items-center gap-2 mb-6 cursor-pointer select-none">
            <div class="relative">
              <input type="checkbox" v-model="rememberMe" class="sr-only peer">
              <div class="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                <svg v-if="rememberMe" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            </div>
            <span class="text-sm text-secondary">{{ t('order.portal.rememberMe') }}</span>
          </label>

          <!-- 登录按钮 -->
          <button 
            type="submit" 
            :disabled="!password || isSubmitting"
            class="w-full h-12 bg-primary text-white font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <svg v-if="isSubmitting" class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ isSubmitting ? t('auth.loggingIn') : t('auth.loginButton') }}</span>
          </button>

          <!-- 错误提示 -->
          <p v-if="error" class="text-red-500 text-sm text-center mt-4 animate-shake">
            {{ error }}
          </p>
        </form>
      </div>

      <!-- 底部提示 -->
      <p class="text-center text-xs text-secondary mt-6">
        {{ t('gallery.poweredBy') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  error: String,
  onSubmit: Function
});

const { t } = useI18n();

const password = ref('');
const rememberMe = ref(true);
const showPassword = ref(false);
const isSubmitting = ref(false);

const handleSubmit = async () => {
  if (!password.value || isSubmitting.value) return;
  
  isSubmitting.value = true;
  try {
    await props.onSubmit(password.value, rememberMe.value);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.animate-shake {
  animation: shake 0.3s ease-in-out;
}
</style>
