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
        class="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all border border-[var(--border-color)]"
        @click.stop
      >
        <!-- 图标/背景装饰 -->
        <div :class="['h-24 flex items-center justify-center relative overflow-hidden', typeClasses.bg]">
          <div class="absolute inset-0 opacity-10 blur-2xl transform scale-150 rotate-12" :class="typeClasses.accent"></div>
          
          <div :class="['w-14 h-14 rounded-full flex items-center justify-center relative z-10', typeClasses.iconBg, typeClasses.iconText]">
            <!-- Success -->
            <svg v-if="type === 'success'" class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <!-- Danger -->
            <svg v-else-if="type === 'danger'" class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <!-- Warning -->
            <svg v-else-if="type === 'warning'" class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <!-- Info / Primary (default) -->
            <svg v-else class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <!-- 内容 -->
        <div class="px-6 py-6 text-center">
          <h3 class="text-xl font-bold text-[var(--text-main)] mb-2">{{ title || t('common.confirmTitle') }}</h3>
          <p class="text-[var(--text-secondary)] text-sm leading-relaxed">
            <slot>{{ message || t('common.confirmMessageDefault') }}</slot>
          </p>

          <!-- Input verification -->
          <div v-if="showInput" class="mt-4">
            <p v-if="inputLabel" class="text-xs font-medium text-[var(--text-muted)] mb-2 text-left">{{ inputLabel }}</p>
            <input 
              ref="inputField"
              v-model="inputValue"
              :type="inputType"
              :placeholder="inputPlaceholder"
              class="w-full px-4 py-2.5 bg-[var(--bg-muted)] border border-[var(--border-color)] rounded-xl text-sm transition-all focus:bg-[var(--bg-card)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none text-[var(--text-main)] placeholder-[var(--text-muted)]"
              @keyup.enter="handleConfirm"
            >
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="px-6 pb-6 flex items-center gap-3">
          <button 
            @click="handleCancel"
            :disabled="loading"
            class="flex-1 py-2.5 px-4 text-sm font-semibold text-[var(--text-secondary)] bg-[var(--bg-muted)] rounded-xl hover:bg-[var(--bg-hover)] transition-all active:scale-95 disabled:opacity-50"
          >
            {{ cancelText || t('common.cancel') }}
          </button>
          <button 
            @click="handleConfirm"
            :disabled="isConfirmDisabled"
            :class="[
              'flex-1 py-2.5 px-4 text-sm font-semibold text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2',
              typeClasses.btn,
              isConfirmDisabled ? 'opacity-70 cursor-not-allowed' : ''
            ]"
          >

            <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
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

const props = defineProps({
  modelValue: Boolean,
  title: String,
  message: String,
  confirmText: String,
  cancelText: String,
  type: {
    type: String, // 'primary' | 'danger' | 'warning' | 'success' | 'info'
    default: 'primary'
  },
  loading: {
    type: Boolean,
    default: false
  },
  // Input verification
  showInput: Boolean,
  inputPlaceholder: String,
  inputLabel: String,
  inputType: {
    type: String,
    default: 'text'
  },
  verifyText: String // If provided, confirm button disabled until input matches
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

// Modal Stack Integration
const { register, unregister, getZIndex, isTopModal, generateModalId } = useModalStack();
const modalId = ref(generateModalId('confirm'));

// 动态 Z-Index 样式
const zStyle = computed(() => ({
  zIndex: getZIndex(modalId.value)
}));

// 背景色样式（复用 Modal.vue 逻辑）
const backdropStyle = computed(() => {
  const bgColor = isTopModal(modalId.value) 
    ? 'var(--color-overlay-blur)' 
    : 'var(--color-overlay-dim)';
  return { 
    ...zStyle.value,
    backgroundColor: bgColor 
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
watch(() => props.modelValue, (val) => {
  if (val) {
    register(modalId.value);
    inputValue.value = '';
    if (props.showInput) {
      nextTick(() => inputField.value?.focus());
    }
  } else {
    unregister(modalId.value);
  }
}, { immediate: true });

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
      btn: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] shadow-[var(--color-primary)]/20'
    },
    danger: {
      bg: 'bg-[var(--color-danger-bg)]',
      accent: 'bg-[var(--color-danger)]',
      iconBg: 'bg-[var(--color-danger-bg)]',
      iconText: 'text-[var(--color-danger)]',
      btn: 'bg-[var(--color-danger)] hover:bg-[var(--color-danger-text)] shadow-[var(--color-danger)]/20'
    },
    warning: {
      bg: 'bg-[var(--color-warning-bg)]',
      accent: 'bg-[var(--color-warning)]',
      iconBg: 'bg-[var(--color-warning-bg)]',
      iconText: 'text-[var(--color-warning-text)]',
      btn: 'bg-[var(--color-warning)] hover:bg-[var(--color-warning-text)] shadow-[var(--color-warning)]/20'
    },
    success: {
      bg: 'bg-[var(--color-success-bg)]',
      accent: 'bg-[var(--color-success)]',
      iconBg: 'bg-[var(--color-success-bg)]',
      iconText: 'text-[var(--color-success-text)]',
      btn: 'bg-[var(--color-success)] hover:bg-[var(--color-success-text)] shadow-[var(--color-success)]/20'
    },
    info: {
      bg: 'bg-[var(--color-info-bg)]',
      accent: 'bg-[var(--color-info)]',
      iconBg: 'bg-[var(--color-info-bg)]',
      iconText: 'text-[var(--color-info-text)]',
      btn: 'bg-[var(--color-info)] hover:bg-[var(--color-info-text)] shadow-[var(--color-info)]/20'
    }
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
.fade-scale-enter-active, .fade-scale-leave-active {
  transition: opacity 0.3s ease;
}
.fade-scale-enter-from, .fade-scale-leave-to {
  opacity: 0;
}
.fade-scale-enter-active .transform {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-scale-enter-from .transform {
  transform: scale(0.9);
}
</style>
