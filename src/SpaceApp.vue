<template>
  <div class="min-h-screen bg-[var(--bg-page)] font-sans text-[var(--text-main)] antialiased">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex min-h-screen items-center justify-center">
      <div class="text-center">
        <div
          class="border-t-primary mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-[var(--border-color)]"
        ></div>
        <p class="text-secondary">{{ t('common.loading') }}</p>
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
        class="text-secondary mt-auto border-t border-[var(--border-color)] bg-white py-8 text-center text-sm"
      >
        <a href="/" class="hover:text-primary transition-colors">{{ t('gallery.poweredBy') }}</a>
      </footer>
    </template>

    <!-- Toast -->
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineAsyncComponent } from 'vue';
import { useI18n } from '@/composables/useI18n';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import SpacePassword from '@/components/space/SpacePassword.vue';
import SpaceTurnstile from '@/components/space/SpaceTurnstile.vue';
import { API } from '@/utils/constants';

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

const loading = ref(true);
const error = ref('');
const space = ref(null);
const requiresPassword = ref(false);
const passwordError = ref('');
const requiresTurnstile = ref(false);
const turnstileVerified = ref(false);
const turnstileSiteKey = ref(''); // 从 API 获取

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

// 从 URL 获取分享令牌
const getShareToken = () => {
  const path = window.location.pathname;
  const match = path.match(/\/space\/([^/]+)/);
  return match ? match[1] : null;
};

// 加载空间
const loadSpace = async (pwd = null) => {
  const token = getShareToken();
  if (!token) {
    error.value = t('spacePublic.invalidLink');
    loading.value = false;
    return;
  }

  try {
    let url = API.PUBLIC_SPACE(token);
    if (pwd) url += `?password=${encodeURIComponent(pwd)}`;

    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      space.value = result.data;
      document.title = `${result.data.name} | KK-Image`;
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
  await loadSpace(pwd);
  if (requiresPassword.value) {
    passwordError.value = t('gallery.passwordError');
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

// 初始化：检查 Turnstile 配置
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
