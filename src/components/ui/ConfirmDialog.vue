<template>
  <Teleport to="body">
    <transition name="fade-scale">
      <div
        v-if="modelValue"
        :class="backdropClass"
        :style="backdropStyle"
        @click.self="handleCancel"
      >
        <div
          class="w-full max-w-sm transform overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl transition-all"
          @click.stop
        >
          <!-- 图标/背景装饰 -->
          <div
            :class="[
              'relative flex h-24 items-center justify-center overflow-hidden',
              typeClasses.bg,
            ]"
          >
            <div
              class="absolute inset-0 scale-150 rotate-12 transform opacity-10 blur-2xl"
              :class="typeClasses.accent"
            ></div>

            <div
              :class="[
                'relative z-10 flex size-14  items-center justify-center rounded-full',
                typeClasses.iconBg,
                typeClasses.iconText,
              ]"
            >
              <!-- Success -->
              <svg
                v-if="type === 'success'"
                class="size-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <!-- Danger -->
              <svg
                v-else-if="type === 'danger'"
                class="size-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <!-- Warning -->
              <svg
                v-else-if="type === 'warning'"
                class="size-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <!-- Info / Primary (default) -->
              <svg v-else class="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          <!-- 内容 -->
          <div class="p-6 text-center">
            <h3 class="mb-2 text-xl font-bold text-[var(--text-main)]">
              {{ title || t('common.confirmTitle') }}
            </h3>
            <p class="text-sm leading-relaxed text-[var(--text-secondary)]">
              <slot>{{ message || t('common.confirmMessageDefault') }}</slot>
            </p>

            <!-- Input verification -->
            <div v-if="showInput" class="mt-4">
              <p
                v-if="inputLabel"
                class="mb-2 text-left text-xs font-medium text-[var(--text-muted)]"
              >
                {{ inputLabel }}
              </p>
              <input
                ref="inputField"
                v-model="inputValue"
                :type="inputType"
                :placeholder="inputPlaceholder"
                class="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] px-4 py-2.5 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] transition-all outline-none focus:border-[var(--color-primary)] focus:bg-[var(--bg-card)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                @keyup.enter="handleConfirm"
              />
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-3 px-6 pb-6">
            <button
              :disabled="loading"
              class="flex-1 rounded-xl bg-[var(--bg-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-hover)] active:scale-95 disabled:opacity-50"
              @click="handleCancel"
            >
              {{ cancelText || t('common.cancel') }}
            </button>
            <button
              :disabled="isConfirmDisabled"
              :class="[
                'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all active:scale-95',
                typeClasses.btn,
                isConfirmDisabled ? 'cursor-not-allowed opacity-70' : '',
              ]"
              @click="handleConfirm"
            >
              <svg v-if="loading" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
              {{ confirmText || t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useModalStack } from '@/composables/useModalStack';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const inputValue = ref('');
const inputField = ref(null);

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '' },
  cancelText: { type: String, default: '' },
  type: {
    type: String, // 'primary' | 'danger' | 'warning' | 'success' | 'info'
    default: 'primary',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  // Input verification
  showInput: Boolean,
  inputPlaceholder: { type: String, default: '' },
  inputLabel: { type: String, default: '' },
  inputType: {
    type: String,
    default: 'text',
  },
  verifyText: { type: String, default: '' }, // If provided, confirm button disabled until input matches
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

// Modal Stack Integration
const { register, unregister, getZIndex, isTopModal, generateModalId } = useModalStack();
const modalId = ref(generateModalId('confirm'));

// 动态 Z-Index 样式
const zStyle = computed(() => ({
  zIndex: getZIndex(modalId.value),
}));

// 背景色样式（复用 Modal.vue 逻辑）
const backdropStyle = computed(() => {
  const bgColor = isTopModal(modalId.value)
    ? 'var(--color-overlay-blur)'
    : 'var(--color-overlay-dim)';
  return {
    ...zStyle.value,
    backgroundColor: bgColor,
  };
});

// 背景样式类 (顶层模糊)
const backdropClass = computed(() => {
  const base = 'fixed inset-0 flex items-center justify-center p-4 overflow-hidden';
  if (isTopModal(modalId.value)) {
    return `${base} backdrop-blur-sm`;
  }
  return base;
});

// 监听打开状态注册/注销到栈
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      register(modalId.value);
      inputValue.value = '';
      if (props.showInput) {
        nextTick(() => inputField.value?.focus());
      }
    } else {
      unregister(modalId.value);
    }
  },
  { immediate: true }
);

// Confirm button disabled state
const isConfirmDisabled = computed(() => {
  if (props.loading) return true;
  if (props.showInput && props.verifyText && inputValue.value !== props.verifyText) return true;
  return false;
});

// Type-based styling using CSS variables
const typeClasses = computed(() => {
  const types = {
    primary: {
      bg: 'bg-[var(--color-primary-bg)]',
      accent: 'bg-[var(--color-primary)]',
      iconBg: 'bg-[var(--color-primary-bg)]',
      iconText: 'text-[var(--color-primary)]',
      btn: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] shadow-[var(--color-primary)]/20',
    },
    danger: {
      bg: 'bg-[var(--color-danger-bg)]',
      accent: 'bg-[var(--color-danger)]',
      iconBg: 'bg-[var(--color-danger-bg)]',
      iconText: 'text-[var(--color-danger)]',
      btn: 'bg-[var(--color-danger)] hover:bg-[var(--color-danger-text)] shadow-[var(--color-danger)]/20',
    },
    warning: {
      bg: 'bg-[var(--color-warning-bg)]',
      accent: 'bg-[var(--color-warning)]',
      iconBg: 'bg-[var(--color-warning-bg)]',
      iconText: 'text-[var(--color-warning-text)]',
      btn: 'bg-[var(--color-warning)] hover:bg-[var(--color-warning-text)] shadow-[var(--color-warning)]/20',
    },
    success: {
      bg: 'bg-[var(--color-success-bg)]',
      accent: 'bg-[var(--color-success)]',
      iconBg: 'bg-[var(--color-success-bg)]',
      iconText: 'text-[var(--color-success-text)]',
      btn: 'bg-[var(--color-success)] hover:bg-[var(--color-success-text)] shadow-[var(--color-success)]/20',
    },
    info: {
      bg: 'bg-[var(--color-info-bg)]',
      accent: 'bg-[var(--color-info)]',
      iconBg: 'bg-[var(--color-info-bg)]',
      iconText: 'text-[var(--color-info-text)]',
      btn: 'bg-[var(--color-info)] hover:bg-[var(--color-info-text)] shadow-[var(--color-info)]/20',
    },
  };
  return types[props.type] || types.primary;
});

const handleCancel = () => {
  if (props.loading) return;
  emit('update:modelValue', false);
  emit('cancel');
};

const handleConfirm = () => {
  if (isConfirmDisabled.value) return;
  emit('confirm', inputValue.value);
};

// ESC key to close
const handleKeyDown = (e) => {
  if (!props.modelValue) return;
  if (e.key === 'Escape' && !props.loading) {
    handleCancel();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.3s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
}
.fade-scale-enter-active .transform {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-scale-enter-from .transform {
  transform: scale(0.9);
}
</style>
