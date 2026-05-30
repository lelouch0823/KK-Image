<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition ease-out-expo duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        :class="backdropClass"
        :style="backdropStyle"
        @click.self="handleBackdropClick"
      >
        <transition
          enter-active-class="transition ease-out-expo duration-250"
          enter-from-class="opacity-0 scale-[0.97] translate-y-3"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-150"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-[0.97] translate-y-2"
        >
          <div
            v-if="modelValue"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="labelledBy || (title ? modalTitleId : undefined)"
            data-modal-surface="base"
            class="animate-in flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-(--border-color) bg-(--color-modal-bg) shadow-2xl"
            :class="sizeClass"
          >
            <!-- Header -->
            <div
              v-if="title || $slots.header"
              class="flex items-center justify-between border-b border-(--border-color) px-6 py-4"
            >
              <slot name="header">
                <h3 :id="modalTitleId" class="text-primary text-lg font-semibold">{{ title }}</h3>
              </slot>
              <button
                v-if="closable"
                type="button"
                aria-label="Close modal"
                class="-mr-1 p-1 text-(--text-muted) transition-colors hover:text-(--text-main)"
                @click="close"
              >
                <AppIcon name="x-mark" class="size-5" />
              </button>
            </div>

            <!-- Body -->
            <div class="min-h-0 flex-1 overflow-y-auto p-6" :class="bodyClass">
              <slot></slot>
            </div>

            <!-- Footer -->
            <div
              v-if="$slots.footer"
              class="flex justify-end gap-3 border-t border-(--border-color) bg-(--bg-muted)/50 px-6 py-4"
            >
              <slot name="footer"></slot>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { useModalStack } from '@/composables/useModalStack';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) =>
      ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', 'full'].includes(v),
  },
  closable: {
    type: Boolean,
    default: true,
  },
  closeOnBackdrop: {
    type: Boolean,
    default: true,
  },
  bodyClass: {
    type: String,
    default: '',
  },
  labelledBy: {
    type: String,
    default: '',
  },
  zIndex: {
    type: [Number, String],
    default: null,
  },
});

const emit = defineEmits(['update:modelValue', 'close']);

// 智能堆叠管理
const {
  generateModalId,
  register,
  unregister,
  shouldShowBlur,
  isTopModal,
  getZIndex,
  hasOpenModals,
} = useModalStack();
const modalId = ref(generateModalId());
const modalTitleId = computed(() => `modal-title-${modalId.value}`);

// 动态 z-index 样式
// SOTA: 使用 inline style 而不是 Tailwind class，因为动态数值类名在生产构建中无法被正确提取
const zStyle = computed(() => {
  // 如果传入了有效的 zIndex prop，优先使用
  if (props.zIndex !== null && props.zIndex !== undefined) {
    return { zIndex: props.zIndex };
  }
  // 否则使用自动计算的层级
  return { zIndex: getZIndex(modalId.value) };
});

// 背景样式类（只有最顶层显示毛玻璃）
const backdropClass = computed(() => {
  const base = 'fixed inset-0 flex items-center justify-center px-4 py-6 overflow-hidden';
  // 最顶层添加毛玻璃效果
  if (shouldShowBlur(modalId.value)) {
    return `${base} backdrop-blur-sm`;
  }
  return base;
});

// 背景色样式（使用 inline style 因为 Tailwind 无法解析 rgba CSS 变量）
const backdropStyle = computed(() => {
  const bgColor = shouldShowBlur(modalId.value)
    ? 'var(--color-overlay-blur)'
    : 'var(--color-overlay-dim)';
  return {
    ...zStyle.value,
    backgroundColor: bgColor,
  };
});

const sizeClass = computed(() => {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    full: 'max-w-full',
  };
  return sizes[props.size];
});

const close = () => {
  emit('update:modelValue', false);
  emit('close');
};

const handleBackdropClick = () => {
  if (props.closeOnBackdrop) {
    close();
  }
};

const syncBodyScrollLock = () => {
  document.body.style.overflow = hasOpenModals.value ? 'hidden' : '';
};

// ESC 键关闭（仅最顶层响应）
const handleKeydown = (e) => {
  if (!props.modelValue || !isTopModal(modalId.value)) return;

  if (e.key === 'Escape' && props.closable) {
    close();
    return;
  }

  // 焦点陷阱：Tab 时焦点在 Modal 内循环
  if (e.key === 'Tab') {
    const focusableEls = getFocusableElements();
    if (focusableEls.length === 0) return;

    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
};

// 获取 Modal 内可聚焦元素
const getFocusableElements = () => {
  const modalEl = document.querySelector(`[data-modal-surface="base"]`);
  if (!modalEl) return [];
  return Array.from(
    modalEl.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
};

// 注册/注销 Modal
watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      register(modalId.value);
      syncBodyScrollLock();
      document.addEventListener('keydown', handleKeydown);
      // 自动聚焦到第一个可交互元素
      nextTick(() => {
        const focusableEls = getFocusableElements();
        if (focusableEls.length > 0) {
          focusableEls[0].focus();
        }
      });
    } else {
      unregister(modalId.value);
      syncBodyScrollLock();
      document.removeEventListener('keydown', handleKeydown);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  unregister(modalId.value);
  document.removeEventListener('keydown', handleKeydown);
  syncBodyScrollLock();
});
</script>

<style scoped>
@media print {
  /* Remove dark backdrop */
  :deep(.fixed.inset-0) {
    background: transparent !important;
    position: static !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  /* Remove modal card shadow and border */
  :deep([data-modal-surface='base']) {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    max-height: none !important;
  }

  /* Ensure muted text uses variables */
  button[aria-label] {
    display: none !important;
  }
}
</style>
