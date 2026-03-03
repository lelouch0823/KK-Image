<template>
  <div
    class="bg-pattern flex min-h-screen items-center justify-center bg-(--bg-page) p-4 font-sans text-(--text-main) antialiased"
  >
    <div class="w-full max-w-md">
      <!-- 登录卡片 -->
      <div
        class="animate-scale-in shadow-glass overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card)/90 ring-1 ring-black/5 backdrop-blur-xl"
      >
        <!-- 头部 -->
        <div class="px-8 pt-10 pb-6 text-center">
          <!-- Logo -->
          <div
            class="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-2xl font-bold text-white shadow-lg dark:from-blue-500 dark:to-indigo-600"
          >
            KK
          </div>
          <h1 class="text-primary mb-2 text-2xl font-bold">{{ t('auth.welcome') }}</h1>
          <p class="text-sm text-(--text-secondary)">{{ t('auth.subtitle') }}</p>
        </div>

        <!-- 登录与转场容器 -->
        <div class="relative overflow-hidden">
          <transition name="fade-slide-up" mode="out-in">
            <!-- 登录表单 -->
            <form v-if="!redirecting" class="px-8 pb-10" @submit.prevent="handleLogin">
              <!-- 用户名 -->
              <div class="mb-5">
                <AppInput
                  v-model="username"
                  :label="t('auth.username')"
                  type="text"
                  required
                  autocomplete="username"
                  :placeholder="t('auth.usernamePlaceholder')"
                >
                  <template #prepend>
                    <AppIcon name="user" class="text-secondary size-5" />
                  </template>
                </AppInput>
              </div>

              <!-- 密码 -->
              <div class="mb-6">
                <AppInput
                  v-model="password"
                  :label="t('auth.password')"
                  :type="showPassword ? 'text' : 'password'"
                  :placeholder="t('auth.passwordPlaceholder')"
                  required
                  autocomplete="current-password"
                  @keyup.enter="handleLogin"
                >
                  <template #prepend>
                    <AppIcon name="lock-closed" class="size-5" />
                  </template>
                  <template #append>
                    <AppButton
                      variant="ghost"
                      class="hover:text-primary hover:bg-transparent !h-auto !p-1.5 text-(--text-muted)"
                      @click="showPassword = !showPassword"
                    >
                      <template #icon-left>
                        <AppIcon v-if="!showPassword" name="eye" class="size-5" />
                        <AppIcon v-else name="eye-slash" class="size-5" />
                      </template>
                    </AppButton>
                  </template>
                </AppInput>
              </div>

              <!-- Cloudflare Turnstile Widget -->
              <div v-if="turnstileEnabled" class="mb-6">
                <div
                  ref="turnstileContainer"
                  class="cf-turnstile"
                  :data-sitekey="turnstileSiteKey"
                  data-callback="onTurnstileSuccess"
                  :data-theme="document.documentElement.classList.contains('dark') ? 'dark' : 'light'"
                ></div>
              </div>

              <!-- 登录按钮 -->
              <AppButton
                type="submit"
                variant="primary"
                block
                size="lg"
                :loading="loading || (turnstileEnabled && !turnstileToken)"
                :text="
                  loading
                    ? t('auth.loggingIn')
                    : turnstileEnabled && !turnstileToken
                      ? t('auth.verifying') || 'Verifying...'
                      : t('auth.loginButton')
                "
              >
                <template #icon-left>
                  <AppIcon
                    v-if="!loading && (!turnstileEnabled || turnstileToken)"
                    name="arrow-left-on-rectangle"
                    class="size-5"
                  />
                </template>
              </AppButton>
            </form>

            <!-- 成功转场状态 -->
            <div v-else class="flex flex-col items-center justify-center px-8 pt-4 pb-16 text-center">
              <div class="relative mb-6">
                <div class="bg-primary/20 absolute inset-0 size-16 animate-ping rounded-full"></div>
                <div
                  class="bg-primary relative flex size-16 items-center justify-center rounded-full text-(--text-inverse) shadow-lg"
                >
                  <AppIcon name="check" class="size-8" stroke-width="3" />
                </div>
              </div>
              <h2 class="text-primary mb-2 text-xl font-bold italic">{{ t('auth.loginSuccess') }}</h2>
              <div class="flex items-center gap-2 text-sm text-(--text-secondary)">
                <AppIcon name="spinner" class="size-4 animate-spin" />
                <span>{{ t('auth.preparingWorkspace') }}</span>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- 底部链接 -->
      <div class="text-secondary mt-8 text-center text-sm">
        <a
          href="https://github.com/cf-pages/KK-Image"
          target="_blank"
          rel="noopener"
          class="hover:text-primary inline-flex items-center gap-1 transition-colors"
        >
          <AppIcon name="github" class="size-4" />
          <span>KK-Image</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeMount } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { addToast } = useToast();
const { t } = useI18n();
const router = useRouter();

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const redirecting = ref(false);
const error = ref('');
const turnstileToken = ref('');
const turnstileContainer = ref(null);
const turnstileEnabled = ref(false);
const turnstileSiteKey = ref('');

// Turnstile 回调
if (typeof window !== 'undefined') {
  window.onTurnstileSuccess = (token) => {
    turnstileToken.value = token;
  };
}

// 登录成功后的检查已被移除，由路由守卫处理

// 获取配置
const handleLogin = async () => {
  if (loading.value || redirecting.value) return;

  if (!username.value || !password.value) {
    addToast({ message: t('auth.inputRequired'), type: 'warning' });
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const response = await fetch(API.LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        password: password.value,
        turnstileToken: turnstileToken.value,
      }),
      credentials: 'include',
    });

    const result = await response.json();

    if (response.ok && result.success) {
      redirecting.value = true;
      addToast({ message: t('auth.loginSuccess'), type: 'success' });
      
      // 平滑跳转
      setTimeout(() => {
        // 使用 router 跳转代替 window.location
        router.push(router.currentRoute.value.query.redirect || '/admin');
      }, 800);
    } else {
      loading.value = false; // Add this back if login fails
      // 刷新 Turnstile
      if (window.turnstile && turnstileEnabled.value) {
        window.turnstile.reset();
        turnstileToken.value = '';
      }
      
      const msg = result.message || t('common.invalidCredentials');
      error.value = msg;
      addToast({ message: msg, type: 'error' });
    }
  } catch (err) {
    loading.value = false; // Add this back if login errors
    console.error('Login error:', err);
    error.value = t('auth.loginFailed');
    addToast({ message: t('auth.loginFailed'), type: 'error' });
  }
};

// 轮询检查 Turnstile 是否加载完成
const waitForTurnstile = () => {
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds
  const interval = setInterval(() => {
    attempts++;
    if (window.turnstile && turnstileContainer.value) {
      clearInterval(interval);
      try {
        window.turnstile.render(turnstileContainer.value, {
          sitekey: turnstileSiteKey.value,
          callback: (token) => {
            turnstileToken.value = token;
          },
          'error-callback': () => {
             console.warn('Turnstile error');
          }
        });
      } catch (e) {
        console.error('Turnstile render error:', e);
      }
    } else if (attempts >= maxAttempts) {
      clearInterval(interval);
      console.warn('Turnstile load timeout');
    }
  }, 100);
};

onBeforeMount(async () => {
  // 从 API 获取 Turnstile 配置
  try {
    const configRes = await fetch(API.TURNSTILE_VERIFY);
    const config = await configRes.json();
    if (config.success && config.data?.enabled) {
      turnstileEnabled.value = true;
      turnstileSiteKey.value = config.data.siteKey;
      waitForTurnstile();
    }
  } catch {
    console.warn('Failed to load Turnstile config');
  }
});
</script>

<style>
/* 背景动画 */
.bg-pattern {
  background-image:
    radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(236, 72, 153, 0.03) 0%, transparent 50%);
}

/* 输入框焦点动画 */
.input-focus {
  transition: all 0.2s ease;
}

.input-focus:focus {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

/* 进场动画：由下而上渐显 */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.animate-scale-in {
  animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* 转场动画 */
.fade-slide-up-enter-active,
.fade-slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
