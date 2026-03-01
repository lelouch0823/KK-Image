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
          <AppIcon name="clipboard-document-list" class="size-8 text-[var(--text-inverse)]" />
        </div>
        <h1 class="text-primary text-2xl font-bold">{{ t('order.portal.loginTitle') }}</h1>
        <p class="text-secondary mt-1 text-sm">{{ t('order.portal.loginSubtitle') }}</p>
      </div>

      <!-- 登录表单 -->
      <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-xl">
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
                class="focus:border-primary focus:ring-primary/10 focus:bg-[var(--bg-card)] focus:ring-4 focus:outline-none placeholder:text-muted/60 h-12 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] px-4 pr-12 text-sm transition-all"
              />
              <button
                type="button"
                class="text-muted absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-2 transition-colors hover:text-primary hover:bg-black/5 active:scale-90 focus-visible:ring-primary/30 min-h-11 min-w-11 focus-visible:ring-2 focus-visible:outline-none"
                @click="showPassword = !showPassword"
              >
                <AppIcon v-if="showPassword" name="eye-slash" class="size-5" />
                <AppIcon v-else name="eye" class="size-5" />
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
                <AppIcon
                  v-if="rememberMe"
                  name="check"
                  class="size-3 stroke-3 text-[var(--text-inverse)]"
                />
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
            <AppIcon v-if="isSubmitting" name="spinner" class="size-5 animate-spin" />
            <span>{{ isSubmitting ? t('auth.loggingIn') : t('auth.loginButton') }}</span>
          </button>

          <!-- 错误提示 -->
          <p
            v-if="error"
            class="animate-shake mt-4 text-center text-sm text-[var(--color-danger)]"
            role="alert"
            aria-live="assertive"
            data-testid="login-error"
          >
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
import AppIcon from '@/components/ui/AppIcon.vue';

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
