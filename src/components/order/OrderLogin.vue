<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--bg-page)] to-[var(--bg-muted)] px-4"
  >
    <div class="w-full max-w-sm">
      <!-- Logo 和标题 -->
      <div class="mb-8 text-center">
        <div
          class="from-primary mx-auto mb-4 flex size-16 transform items-center justify-center rounded-2xl bg-gradient-to-br to-[var(--color-gray-700)] shadow-lg transition-transform hover:scale-105"
        >
          <svg class="size-8 text-[var(--text-inverse)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            ></path>
          </svg>
        </div>
        <h1 class="text-primary text-2xl font-bold">{{ t('order.portal.loginTitle') }}</h1>
        <p class="text-secondary mt-1 text-sm">{{ t('order.portal.loginSubtitle') }}</p>
      </div>

      <!-- 登录表单 -->
      <div class="rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-xl">
        <form @submit.prevent="handleSubmit">
          <!-- 密码输入 -->
          <div class="mb-5">
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('auth.password') }}
            </label>
            <div class="group relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('auth.passwordPlaceholder')"
                autocomplete="current-password"
                class="focus:border-primary focus:ring-primary/10 focus:bg-white focus:ring-4 focus:outline-none placeholder:text-muted/60 h-12 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] px-4 pr-12 text-sm transition-all"
              />
              <button
                type="button"
                class="text-muted absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-2 transition-colors hover:text-primary hover:bg-black/5 active:scale-90"
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="showPassword"
                  class="size-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  ></path>
                </svg>
                <svg v-else class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  ></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- 记住我 -->
          <label class="mb-6 flex cursor-pointer items-center gap-2 select-none">
            <div class="relative">
              <input v-model="rememberMe" type="checkbox" class="peer sr-only" />
              <div
                class="peer-checked:bg-primary peer-checked:border-primary flex size-5 items-center justify-center rounded-md border-2 border-[var(--border-hover)] transition-all"
              >
                <svg
                  v-if="rememberMe"
                  class="size-3 text-[var(--text-inverse)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="3"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
            </div>
            <span class="text-secondary text-sm">{{ t('order.portal.rememberMe') }}</span>
          </label>

          <!-- 登录按钮 -->
          <button
            type="submit"
            :disabled="!password || isSubmitting"
            class="bg-primary flex h-12 w-full items-center justify-center gap-2 rounded-xl font-medium text-[var(--text-inverse)] transition-all hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              v-if="isSubmitting"
              class="size-5 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{{ isSubmitting ? t('auth.loggingIn') : t('auth.loginButton') }}</span>
          </button>

          <!-- 错误提示 -->
          <p v-if="error" class="animate-shake mt-4 text-center text-sm text-[var(--color-danger)]">
            {{ error }}
          </p>
        </form>
      </div>

      <!-- 底部提示 -->
      <p class="text-secondary mt-6 text-center text-xs">
        {{ t('gallery.poweredBy') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  error: { type: String, default: '' },
  onSubmit: { type: Function, default: () => {} },
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
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}
.animate-shake {
  animation: shake 0.3s ease-in-out;
}
</style>
