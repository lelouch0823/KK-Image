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
          class="mx-4 w-full max-w-sm transform overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) shadow-2xl transition-all"
          @click.stop
        >
          <!-- 图标/背景装饰 -->
          <div
            :class="[
              'relative flex h-20 items-center justify-center overflow-hidden',
              typeClasses.bg,
            ]"
          >
            <div
              class="absolute inset-0 scale-150 rotate-12 transform opacity-10 blur-2xl"
              :class="typeClasses.accent"
            ></div>

            <div
              :class="[
                'relative z-10 flex size-12 items-center justify-center rounded-full',
                typeClasses.iconBg,
                typeClasses.iconText,
              ]"
            >
              <!-- Success -->
              <AppIcon v-if="type === 'success'" name="check" class="size-6" />
              <!-- Danger -->
              <AppIcon v-else-if="type === 'danger'" name="exclamation-triangle" class="size-6" />
              <!-- Warning -->
              <AppIcon v-else-if="type === 'warning'" name="exclamation-circle" class="size-6" />
              <!-- Info / Primary (default) -->
              <AppIcon v-else name="information-circle" class="size-6" />
            </div>
          </div>

          <!-- 内容 -->
          <div class="px-6 pt-4 pb-2 text-center">
            <h3 class="mb-1.5 text-base font-semibold text-(--text-main)">
              {{ title || t('common.confirmTitle') }}
            </h3>
            <p class="text-sm leading-relaxed text-(--text-secondary)">
              <slot>{{ message || t('common.confirmMessageDefault') }}</slot>
            </p>

            <!-- Input verification -->
            <div v-if="showInput" class="mt-4">
              <p v-if="inputLabel" class="mb-2 text-left text-xs font-medium text-(--text-muted)">
                {{ inputLabel }}
              </p>
              <AppInput
                v-if="showInput"
                ref="inputField"
                v-model="inputValue"
                :placeholder="inputPlaceholder"
                class="mt-2"
                @keyup.enter="!isConfirmDisabled && handleConfirm()"
              />
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex justify-end gap-3 px-6 pb-5 pt-2">
            <AppButton
              variant="secondary"
              :text="cancelText || t('common.cancel')"
              :disabled="loading"
              @click="handleCancel"
            />
            <AppButton
              :variant="confirmButtonVariant"
              :text="confirmText || t('common.confirm')"
              :loading="loading"
              :disabled="isConfirmDisabled"
              @click="handleConfirm"
            />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, useTemplateRef } from 'vue';
import { useModalStack } from '@/composables/useModalStack';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { t } = useI18n();
const inputValue = ref('');
const inputField = useTemplateRef('inputField');

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
  inputRequired: Boolean, // New: Require non-empty input
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
  if (props.showInput) {
    if (props.verifyText && inputValue.value !== props.verifyText) return true;
    if (props.inputRequired && !inputValue.value.trim()) return true;
  }
  return false;
});

const confirmButtonVariant = computed(() => {
  if (props.type === 'danger') return 'danger';
  if (props.type === 'warning') return 'outline';
  if (props.type === 'success') return 'primary';
  if (props.type === 'info') return 'outline';
  return 'primary';
});

// Type-based styling using CSS variables
const typeClasses = computed(() => {
  const types = {
    primary: {
      bg: 'bg-(--color-primary-bg)',
      accent: 'bg-primary',
      iconBg: 'bg-(--color-primary-bg)',
      iconText: 'text-primary',
      btn: 'bg-primary hover:bg-(--color-primary-hover) shadow-primary/20',
    },
    danger: {
      bg: 'bg-(--color-danger-bg)',
      accent: 'bg-danger',
      iconBg: 'bg-(--color-danger-bg)',
      iconText: 'text-danger',
      btn: 'bg-danger hover:bg-(--color-danger-text) shadow-danger/20',
    },
    warning: {
      bg: 'bg-(--color-warning-bg)',
      accent: 'bg-warning',
      iconBg: 'bg-(--color-warning-bg)',
      iconText: 'text-(--color-warning-text)',
      btn: 'bg-warning hover:bg-(--color-warning-text) shadow-warning/20',
    },
    success: {
      bg: 'bg-(--color-success-bg)',
      accent: 'bg-success',
      iconBg: 'bg-(--color-success-bg)',
      iconText: 'text-(--color-success-text)',
      btn: 'bg-success hover:bg-(--color-success-text) shadow-success/20',
    },
    info: {
      bg: 'bg-(--color-info-bg)',
      accent: 'bg-info',
      iconBg: 'bg-(--color-info-bg)',
      iconText: 'text-(--color-info-text)',
      btn: 'bg-info hover:bg-(--color-info-text) shadow-info/20',
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
  if (!props.modelValue || !isTopModal(modalId.value)) return;
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
  transition: opacity 250ms cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
}
.fade-scale-enter-active .transform {
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-scale-leave-active .transform {
  transition: transform 200ms ease-in;
}
.fade-scale-enter-from .transform {
  transform: scale(0.95) translateY(8px);
}
.fade-scale-leave-to .transform {
  transform: scale(0.97) translateY(4px);
}
</style>
