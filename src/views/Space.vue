<template>
  <div class="min-h-screen bg-[var(--bg-page)] font-sans text-[var(--text-main)] antialiased">
    <!-- 加载状态 -->
    <!-- 加载状态 -->
    <div v-if="loading" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div class="space-y-4">
          <Skeleton type="text" width="w-64" class="h-8" />
          <Skeleton type="text" width="w-96" class="h-4" />
        </div>
        <Skeleton type="custom" custom-class="h-10 w-32 rounded-lg" />
      </div>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <Skeleton v-for="i in 8" :key="i" type="custom" custom-class="aspect-square w-full rounded-xl" />
      </div>
    </div>

    <!-- Turnstile 验证 -->
    <SpaceTurnstile
      v-else-if="requiresTurnstile && !turnstileVerified"
      :site-key="turnstileSiteKey"
      :on-verified="handleTurnstileVerified"
    />

    <!-- 密码验证 -->
    <SpacePassword
      v-else-if="requiresPassword"
      :error="passwordError"
      :on-submit="submitPassword"
    />

    <!-- 错误状态 -->
    <div v-else-if="error" class="flex min-h-screen items-center justify-center px-4">
      <div class="text-center">
        <div
          class="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-[var(--color-danger-bg)]"
        >
          <svg
            class="size-10 text-[var(--color-danger-text)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            ></path>
          </svg>
        </div>
        <h2 class="text-primary mb-2 text-xl font-semibold">{{ t('spacePublic.cannotLoad') }}</h2>
        <p class="text-secondary">{{ error }}</p>
      </div>
    </div>

    <!-- 空间内容 -->
    <template v-else-if="space">
      <!-- 根据模版渲染不同组件 -->
      <component :is="spaceComponent" :space="space" />

      <!-- Footer -->
      <footer
        class="text-secondary mt-auto border-t border-[var(--border-color)] bg-[var(--bg-card)] py-8 text-center text-sm"
      >
        <a href="/" class="hover:text-primary transition-colors">{{ t('gallery.poweredBy') }}</a>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineAsyncComponent, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import SpacePassword from '@/components/space/SpacePassword.vue';
import SpaceTurnstile from '@/components/space/SpaceTurnstile.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import { API, APP_NAME } from '@/utils/constants';

// 懒加载不同模版组件
const SpaceMasonry = defineAsyncComponent(() => import('@/components/space/SpaceMasonry.vue'));
const SpaceProductDetail = defineAsyncComponent(
  () => import('@/components/space/SpaceProductDetail.vue')
);
const SpaceCollection = defineAsyncComponent(
  () => import('@/components/space/SpaceCollection.vue')
);
// Document, Portfolio 等暂复用 Masonry 或开发简易版
const SpaceDocument = defineAsyncComponent(() => import('@/components/space/SpaceMasonry.vue'));

const { t } = useI18n();
const route = useRoute();

const loading = ref(true);
const error = ref('');
const space = ref(null);
const requiresPassword = ref(false);
const passwordError = ref('');
const requiresTurnstile = ref(false);
const turnstileVerified = ref(false);
const turnstileSiteKey = ref(''); // 从 API 获取

// 从路由获取 Token
const token = computed(() => route.params.token);

const spaceComponent = computed(() => {
  switch (space.value?.template) {
    case 'product':
      return SpaceProductDetail;
    case 'collection':
      return SpaceCollection;
    case 'document':
      return SpaceDocument;
    default:
      return SpaceMasonry; // Gallery & others
  }
});

// 加载空间
const loadSpace = async () => {
  if (!token.value) {
    error.value = t('spacePublic.invalidLink');
    loading.value = false;
    return;
  }

  try {
    const response = await fetch(API.PUBLIC_SPACE(token.value));
    const result = await response.json();

    if (result.success) {
      space.value = result.data;
      document.title = `${result.data.name} | ${APP_NAME}`;
      requiresPassword.value = false;
    } else if (result.requiresPassword) {
      requiresPassword.value = true;
    } else {
      error.value = result.message || t('spacePublic.loadFailed');
    }
  } catch (_e) {
    error.value = t('common.networkErrorRetry');
  } finally {
    loading.value = false;
  }
};

const submitPassword = async (pwd) => {
  if (!pwd) return;
  passwordError.value = '';
  loading.value = true;

  try {
    // 使用 POST 安全传递密码，后端直接返回完整数据
    const response = await fetch(API.PUBLIC_SPACE(token.value), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    const result = await response.json();

    if (result.success && result.data) {
      // 密码验证成功，后端直接返回了完整数据
      space.value = result.data;
      document.title = `${result.data.name} | ${APP_NAME}`;
      requiresPassword.value = false;
      passwordError.value = '';
    } else {
      passwordError.value = result.message || t('gallery.passwordError');
    }
  } catch (_e) {
    passwordError.value = t('common.networkErrorRetry');
  } finally {
    loading.value = false;
  }
};

// Turnstile 验证回调
const handleTurnstileVerified = async (token) => {
  // 后端验证 token
  const response = await fetch(API.TURNSTILE_VERIFY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || result.message || t('spacePublic.verifyFailed'));
  }

  turnstileVerified.value = true;
  // 验证通过后加载空间
  loading.value = true;
  await loadSpace();
};

// 监听 Token 变化 (处理 SPA 同组件跳转)
watch(token, () => {
  loading.value = true;
  space.value = null;
  loadSpace();
});

// 初始化
onMounted(async () => {
  try {
    // 从 API 获取 Turnstile 配置
    const configRes = await fetch(API.TURNSTILE_VERIFY);
    const config = await configRes.json();

    if (config.success && config.data?.enabled) {
      requiresTurnstile.value = true;
      turnstileSiteKey.value = config.data.siteKey;
      loading.value = false; // 让 Turnstile 组件显示
    } else {
      // Turnstile 未配置，直接加载空间
      await loadSpace();
    }
  } catch {
    // 配置获取失败，直接加载空间
    await loadSpace();
  }
});
</script>
