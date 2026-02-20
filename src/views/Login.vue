<template>
  <div
    class="bg-pattern flex min-h-screen items-center justify-center bg-[var(--bg-page)] p-4 font-sans text-[var(--text-main)] antialiased"
  >
    <div class="w-full max-w-md">
      <!-- 登录卡片 -->
      <div
        class="animate-scale-in shadow-glass overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]/90 ring-1 ring-black/5 backdrop-blur-xl"
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
                    <svg
                      class="text-secondary size-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      ></path>
                    </svg>
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
                    <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      ></path>
                    </svg>
                  </template>
                  <template #append>
                    <AppButton
                      variant="ghost"
                      class="hover:text-primary hover:bg-transparent !h-auto !p-1.5 text-(--text-muted)"
                      @click="showPassword = !showPassword"
                    >
                      <template #icon-left>
                        <svg
                          v-if="!showPassword"
                          class="size-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1.5"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          ></path>
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1.5"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          ></path>
                        </svg>
                        <svg v-else class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1.5"
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          ></path>
                        </svg>
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
                  <svg
                    v-if="!loading && (!turnstileEnabled || turnstileToken)"
                    class="size-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                </template>
              </AppButton>
            </form>

            <!-- 成功转场状态 -->
            <div v-else class="flex flex-col items-center justify-center px-8 pt-4 pb-16 text-center">
              <div class="relative mb-6">
                <div class="bg-primary/20 absolute inset-0 size-16 animate-ping rounded-full"></div>
                <div
                  class="bg-primary relative flex size-16 items-center justify-center rounded-full text-[var(--text-inverse)] shadow-lg"
                >
                  <svg class="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="3"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </div>
              </div>
              <h2 class="text-primary mb-2 text-xl font-bold italic">{{ t('auth.loginSuccess') }}</h2>
              <div class="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <svg class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  ></path>
                </svg>
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
          <svg class="size-4" fill="currentColor" viewBox="0 0 24 24">
            <path
              fill-rule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clip-rule="evenodd"
            ></path>
          </svg>
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
