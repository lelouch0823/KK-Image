<template>
  <div
    class="app-image"
    :class="[
      containerClasses,
      { 'app-image--lazy': lazy && !isIntersecting },
    ]"
    :style="containerStyle"
    ref="containerRef"
  >
    <!-- 占位层 (加载中或懒加载未触发) -->
    <div
      v-if="showPlaceholder"
      class="app-image__placeholder"
      :style="placeholderStyle"
    >
      <slot name="placeholder">
        <!-- Blurhash 占位 -->
        <img
          v-if="blurhashDataUrl"
          :src="blurhashDataUrl"
          class="app-image__blurhash"
          alt=""
        />
        <!-- 骨架屏占位 -->
        <div v-else class="app-image__skeleton" />
      </slot>
    </div>

    <!-- 实际图片 -->
    <img
      v-if="shouldLoad"
      ref="imageRef"
      :src="currentSrc"
      :alt="alt"
      :class="imageClasses"
      :style="imageStyle"
      @load="handleLoad"
      @error="handleError"
    />

    <!-- 错误态 -->
    <div v-if="state === 'error'" class="app-image__error">
      <slot name="error">
        <div class="app-image__error-content">
          <svg class="app-image__error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
          <button
            v-if="retryable"
            type="button"
            class="app-image__retry-btn"
            @click="handleRetry"
          >
            {{ t('common.retry') }}
          </button>
        </div>
      </slot>
    </div>

    <!-- 业务状态角标 -->
    <div v-if="status && state === 'loaded'" class="app-image__badge" :class="badgeClass">
      <slot name="badge">
        <span v-if="status === 'blocked'" class="app-image__badge-blocked">🚫</span>
        <span v-else-if="status === 'liked'" class="app-image__badge-liked">❤️</span>
        <span v-else-if="status === 'new'" class="app-image__badge-new">NEW</span>
        <span v-else class="app-image__badge-custom">{{ status }}</span>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { blurhashToDataURL, isBlurhashValid } from '@/utils/blurhash';

const props = defineProps({
  /** 图片 URL */
  src: { type: String, default: '' },
  /** 替代文本 */
  alt: { type: String, default: '' },
  /** 图片宽度 */
  width: { type: [String, Number], default: null },
  /** 图片高度 */
  height: { type: [String, Number], default: null },
  /** object-fit 模式 */
  fit: {
    type: String,
    default: 'cover',
    validator: (v) => ['cover', 'contain', 'fill', 'none', 'scale-down'].includes(v),
  },
  /** 圆角级别 */
  rounded: {
    type: String,
    default: 'md',
    validator: (v) => ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'].includes(v),
  },
  /** Blurhash 占位字符串 */
  blurhash: { type: String, default: null },
  /** 启用懒加载 */
  lazy: { type: Boolean, default: true },
  /** 业务状态标记 */
  status: { type: String, default: null },
  /** 备用图片 URL */
  fallback: { type: String, default: null },
  /** 显示重试按钮 */
  retryable: { type: Boolean, default: false },
  /** 宽高比 (e.g. '16/9', '1/1') */
  aspectRatio: { type: String, default: null },
  /** 懒加载触发边距 */
  rootMargin: { type: String, default: '200px' },
  /** 自定义容器类名 */
  containerClass: { type: String, default: '' },
  /** 禁用过渡动画 */
  noTransition: { type: Boolean, default: false },
});

const emit = defineEmits(['load', 'error', 'retry']);

const { t } = useI18n();

// 状态管理
const state = ref('idle'); // idle, loading, loaded, error
const isIntersecting = ref(!props.lazy);
const retryCount = ref(0);
const containerRef = ref(null);
const imageRef = ref(null);

// Blurhash 解码
const blurhashDataUrl = computed(() => {
  if (!props.blurhash || !isBlurhashValid(props.blurhash)) return null;
  return blurhashToDataURL(props.blurhash, 32, 32);
});

// 当前使用的图片 URL (支持 fallback)
const currentSrc = computed(() => {
  if (state.value === 'error' && props.fallback && retryCount.value === 0) {
    return props.fallback;
  }
  return props.src;
});

// 是否应该加载图片
const shouldLoad = computed(() => {
  if (!props.src) return false;
  if (!props.lazy) return true;
  return isIntersecting.value;
});

// 是否显示占位符
const showPlaceholder = computed(() => state.value === 'idle' || state.value === 'loading');

// 容器类名
const containerClasses = computed(() => [
  props.containerClass,
  `app-image--rounded-${props.rounded}`,
  {
    'app-image--loading': state.value === 'loading',
    'app-image--loaded': state.value === 'loaded',
    'app-image--error': state.value === 'error',
    'app-image--no-transition': props.noTransition,
  },
]);

// 容器样式
const containerStyle = computed(() => {
  const style = {};
  if (props.width) style.width = typeof props.width === 'number' ? `${props.width}px` : props.width;
  if (props.height) style.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
  if (props.aspectRatio) style.aspectRatio = props.aspectRatio;
  return style;
});

// 图片类名
const imageClasses = computed(() => [
  'app-image__img',
  `app-image__img--fit-${props.fit}`,
]);

// 图片样式
const imageStyle = computed(() => ({
  opacity: state.value === 'loaded' ? 1 : 0,
}));

// 占位符样式
const placeholderStyle = computed(() => ({
  opacity: showPlaceholder.value ? 1 : 0,
}));

// Badge 类名
const badgeClass = computed(() => `app-image__badge--${props.status}`);

// Intersection Observer
let observer = null;

onMounted(() => {
  if (props.lazy && containerRef.value) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          isIntersecting.value = true;
          observer?.disconnect();
        }
      },
      { rootMargin: props.rootMargin }
    );
    observer.observe(containerRef.value);
  }
});

onUnmounted(() => {
  observer?.disconnect();
});

// 监听 src 变化
watch(() => props.src, () => {
  state.value = 'idle';
  retryCount.value = 0;
});

// 监听 shouldLoad 变化
watch(shouldLoad, (val) => {
  if (val && state.value === 'idle') {
    state.value = 'loading';
  }
});

// 事件处理
function handleLoad() {
  state.value = 'loaded';
  emit('load');
}

function handleError() {
  // 如果有 fallback 且未尝试过，使用 fallback
  if (props.fallback && retryCount.value === 0) {
    retryCount.value = 1;
    state.value = 'loading';
    return;
  }
  state.value = 'error';
  emit('error');
}

function handleRetry() {
  retryCount.value = 0;
  state.value = 'loading';
  emit('retry');
}
</script>

<style scoped>
.app-image {
  position: relative;
  overflow: hidden;
  background-color: var(--bg-muted);
}

/* 圆角级别 */
.app-image--rounded-none { border-radius: 0; }
.app-image--rounded-sm { border-radius: 0.125rem; }
.app-image--rounded-md { border-radius: 0.375rem; }
.app-image--rounded-lg { border-radius: 0.5rem; }
.app-image--rounded-xl { border-radius: 0.75rem; }
.app-image--rounded-2xl { border-radius: 1rem; }
.app-image--rounded-full { border-radius: 9999px; }

/* 占位层 */
.app-image__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.3s ease;
}

.app-image--no-transition .app-image__placeholder {
  transition: none;
}

/* Blurhash 占位图 */
.app-image__blurhash {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(20px);
  transform: scale(1.2);
}

/* 骨架屏 */
.app-image__skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--bg-muted) 0%,
    var(--bg-hover) 50%,
    var(--bg-muted) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 实际图片 */
.app-image__img {
  width: 100%;
  height: 100%;
  transition: opacity 0.3s ease;
}

.app-image--no-transition .app-image__img {
  transition: none;
}

.app-image__img--fit-cover { object-fit: cover; }
.app-image__img--fit-contain { object-fit: contain; }
.app-image__img--fit-fill { object-fit: fill; }
.app-image__img--fit-none { object-fit: none; }
.app-image__img--fit-scale-down { object-fit: scale-down; }

/* 错误态 */
.app-image__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-muted);
}

.app-image__error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
}

.app-image__error-icon {
  width: 2rem;
  height: 2rem;
  opacity: 0.5;
}

.app-image__retry-btn {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-main);
  background-color: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.app-image__retry-btn:hover {
  background-color: var(--bg-active);
}

/* 业务状态角标 */
.app-image__badge {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  z-index: 10;
}

.app-image__badge-blocked {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.875rem;
  background-color: rgba(239, 68, 68, 0.9);
  border-radius: 9999px;
}

.app-image__badge-liked {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.75rem;
  background-color: rgba(236, 72, 153, 0.9);
  border-radius: 9999px;
}

.app-image__badge-new {
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #10b981, #059669);
  border-radius: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.app-image__badge-custom {
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: white;
  background-color: var(--color-primary);
  border-radius: 0.25rem;
}
</style>
