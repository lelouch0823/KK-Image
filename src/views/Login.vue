<template>
  <div
    class="bg-pattern flex min-h-screen items-center justify-center bg-(--bg-page) p-4 font-sans text-(--text-main) antialiased"
  >
    <div class="w-full max-w-md">
      <!-- 登录卡片 -->
      <div
        class="animate-scale-in shadow-glass overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card)/95 ring-1 ring-(--border-color)/50 backdrop-blur-xl"
      >
        <!-- 头部 -->
        <div class="px-8 pt-10 pb-6 text-center">
          <!-- Logo -->
          <div
            class="bg-primary text-(--text-inverse) mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl text-2xl font-bold shadow-lg"
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
                  :data-theme="turnstileTheme"
                ></div>
              </div>

              <!-- 错误提示 -->
              <div
                v-if="error"
                class="mb-4 flex items-center gap-2 rounded-lg bg-(--color-danger-bg) px-3 py-2 text-sm text-(--color-danger-text)"
              >
                <AppIcon name="exclamation-triangle" class="size-4 shrink-0" />
                <span>{{ error }}</span>
              </div>

              <!-- 登录按钮 -->
              <AppButton
                type="submit"
                variant="primary"
                block
                size="lg"
                :loading="loading"
                :disabled="loading || (turnstileEnabled && !turnstileToken)"
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
            <div
              v-else
              class="flex flex-col items-center justify-center px-8 pt-4 pb-16 text-center"
            >
              <div class="relative mb-6">
                <div class="bg-primary/20 absolute inset-0 size-16 animate-ping rounded-full"></div>
                <div
                  class="bg-primary relative flex size-16 items-center justify-center rounded-full text-(--text-inverse) shadow-lg"
                >
                  <AppIcon name="check" class="size-8" stroke-width="3" />
                </div>
              </div>
              <h2 class="text-primary mb-2 text-xl font-bold italic leading-tight pb-0.5">
                {{ t('auth.loginSuccess') }}
              </h2>
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
          rel="noopener noreferrer"
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
import { ref, onBeforeMount, onMounted } from 'vue';
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
const turnstileTheme = ref('light');

const detectTurnstileTheme = () => {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

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
          },
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

onMounted(() => {
  turnstileTheme.value = detectTurnstileTheme();
});
</script>

<style scoped>
/* 背景 - 柔和的双色渐变 */
.bg-pattern {
  background-image:
    radial-gradient(ellipse at 30% 20%, var(--color-primary-bg) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 80%, var(--color-info-bg) 0%, transparent 60%);
}

/* 进场动画：由下而上渐显 + 微缩放 */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(12px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.animate-scale-in {
  animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>

<style>
/* 转场动画 - 使用 expo 缓动（需全局，Vue transition 类名不受 scoped 约束） */
.fade-slide-up-enter-active,
.fade-slide-up-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-up-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

.fade-slide-up-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
