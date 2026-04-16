<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gradient-to-br from-(--bg-page) to-(--bg-muted) px-4"
  >
    <div class="w-full max-w-sm">
      <!-- Logo 和标题 -->
      <div class="mb-8 text-center">
        <div
          class="from-primary mx-auto mb-4 flex size-16 transform items-center justify-center rounded-2xl bg-gradient-to-br to-(--color-gray-700) shadow-lg transition-transform hover:scale-105"
        >
          <AppIcon name="clipboard-document-list" class="size-8 text-(--text-inverse)" />
        </div>
        <h1 class="text-primary text-2xl font-bold">{{ t('order.portal.loginTitle') }}</h1>
        <p class="text-secondary mt-1 text-sm">{{ t('order.portal.loginSubtitle') }}</p>
      </div>

      <!-- 登录表单 -->
      <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-6 shadow-xl">
        <form @submit.prevent="handleSubmit">
          <!-- 密码输入 -->
          <div class="mb-5">
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('auth.password') }}
            </label>
            <div class="group relative">
              <AppInput
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('auth.passwordPlaceholder')"
                autocomplete="current-password"
                class="pr-12"
              />
              <AppButton
                variant="ghost"
                size="sm"
                class="text-muted absolute top-1/2 right-3 min-h-11 min-w-11 -translate-y-1/2 !gap-0 rounded-lg !px-0 hover:bg-black/5 hover:text-primary focus-visible:ring-primary/30 [&_span]:hidden"
                @click="showPassword = !showPassword"
              >
                <template #icon-left>
                  <AppIcon v-if="showPassword" name="eye-slash" class="size-5" />
                  <AppIcon v-else name="eye" class="size-5" />
                </template>
              </AppButton>
            </div>
          </div>

          <!-- 记住我 -->
          <label class="mb-6 flex cursor-pointer items-center gap-2 select-none">
            <div class="relative">
              <AppCheckbox v-model="rememberMe" />
            </div>
            <span class="text-secondary text-sm">{{ t('order.portal.rememberMe') }}</span>
          </label>

          <!-- 登录按钮 -->
          <AppButton
            type="submit"
            :disabled="!password || isSubmitting"
            :loading="isSubmitting"
            :loading-text="t('auth.loggingIn')"
            size="lg"
            block
          >
            {{ t('auth.loginButton') }}
          </AppButton>

          <!-- 错误提示 -->
          <p
            v-if="error"
            class="animate-shake text-danger mt-4 text-center text-sm"
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
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';

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
