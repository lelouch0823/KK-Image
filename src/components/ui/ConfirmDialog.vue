<template>
  <transition name="fade-scale">
    <div 
      v-if="modelValue" 
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md transition-all sm:p-6"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @click="handleBackdropClick"
    >
      <div 
        class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all border border-gray-100 ring-1 ring-black/5"
        @click.stop
      >
        <!-- Icon/Header Decoration -->
        <div :class="[
          'h-24 flex items-center justify-center relative overflow-hidden',
          typeClasses.bg
        ]">
          <div class="absolute inset-0 opacity-10 blur-2xl transform scale-150 rotate-12" :class="typeClasses.accent"></div>
          
          <div :class="[
            'w-14 h-14 rounded-2xl flex items-center justify-center relative z-10 transition-transform duration-500',
            typeClasses.iconBg,
            typeClasses.iconText,
            loading ? 'scale-90 opacity-50' : 'scale-100'
          ]">
            <slot name="icon">
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
              <!-- Info/Primary -->
              <svg v-else class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </slot>
          </div>
        </div>

        <!-- Content -->
        <div class="px-6 py-6 text-center">
          <h3 :id="titleId" class="text-xl font-bold text-gray-900 mb-2 leading-tight">{{ title }}</h3>
          <p class="text-gray-500 text-sm leading-relaxed px-2">
            <slot>{{ message }}</slot>
          </p>

          <!-- Verification Input -->
          <div v-if="showInput" class="mt-4 px-2">
            <p v-if="inputLabel" class="text-xs font-medium text-gray-400 mb-2 text-left">{{ inputLabel }}</p>
            <input 
              ref="inputField"
              v-model="inputValue"
              :type="inputType"
              :placeholder="inputPlaceholder"
              class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              @keyup.enter="handleConfirm"
            >
            <p v-if="inputError" class="mt-1.5 text-xs text-red-500 text-left px-1">{{ inputError }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="px-6 pb-6 flex items-center gap-3">
          <button 
            v-if="!hideCancel"
            @click="handleCancel"
            :disabled="loading"
            class="flex-1 py-3 px-4 text-sm font-bold text-gray-500 bg-gray-100 rounded-2xl hover:bg-gray-200 hover:text-gray-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ cancelText || $t('common.cancel') }}
          </button>
          <button 
            @click="handleConfirm"
            :disabled="isConfirmDisabled"
            :class="[
              'flex-1 py-3 px-4 text-sm font-bold text-white rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2',
              typeClasses.btn,
              isConfirmDisabled ? 'opacity-50 cursor-not-allowed shadow-none' : ''
            ]"
          >
            <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ confirmText || $t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  title: {
    type: String,
    default: '确认操作'
  },
  message: {
    type: String,
    default: '确定要执行此操作吗？'
  },
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
  // Input verification features
  showInput: Boolean,
  inputPlaceholder: String,
  inputLabel: String,
  inputValue: String, // Allow two-way binding if needed
  inputType: {
    type: String,
    default: 'text'
  },
  verifyText: String, // If provided, confirm button remains disabled until input matches this
  hideCancel: Boolean,
  closeOnBackdrop: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel', 'update:inputValue']);

const titleId = `dialog-title-${Math.random().toString(36).slice(2, 9)}`;
const inputValue = ref('');
const inputError = ref('');
const inputField = ref(null);

// Sync internal inputValue with external if needed
watch(() => props.modelValue, (val) => {
  if (val) {
    inputValue.value = '';
    inputError.value = '';
    if (props.showInput) {
      nextTick(() => {
        inputField.value?.focus();
      });
    }
  }
});

watch(inputValue, (val) => {
  emit('update:inputValue', val);
});

const isConfirmDisabled = computed(() => {
  if (props.loading) return true;
  if (props.showInput && props.verifyText && inputValue.value !== props.verifyText) return true;
  return false;
});

const typeClasses = computed(() => {
  const types = {
    primary: {
      bg: 'bg-primary/5',
      accent: 'bg-primary',
      iconBg: 'bg-primary/10',
      iconText: 'text-primary font-bold',
      btn: 'bg-primary hover:bg-primary-hover shadow-primary/20'
    },
    danger: {
      bg: 'bg-red-50',
      accent: 'bg-red-500',
      iconBg: 'bg-red-100',
      iconText: 'text-red-600',
      btn: 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
    },
    warning: {
      bg: 'bg-orange-50',
      accent: 'bg-orange-500',
      iconBg: 'bg-orange-100',
      iconText: 'text-orange-600',
      btn: 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
    },
    success: {
      bg: 'bg-green-50',
      accent: 'bg-green-500',
      iconBg: 'bg-green-100',
      iconText: 'text-green-600',
      btn: 'bg-green-500 hover:bg-green-600 shadow-green-500/20'
    },
    info: {
      bg: 'bg-blue-50',
      accent: 'bg-blue-500',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600',
      btn: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
    }
  };
  return types[props.type] || types.primary;
});

const handleBackdropClick = () => {
  if (!props.loading && props.closeOnBackdrop) {
    handleCancel();
  }
};

const handleCancel = () => {
  if (props.loading) return;
  emit('update:modelValue', false);
  emit('cancel');
};

const handleConfirm = () => {
  if (isConfirmDisabled.value) return;
  emit('confirm', inputValue.value);
};

// Accessibility: Focus trap and Esc key
const handleKeyDown = (e) => {
  if (!props.modelValue) return;
  if (e.key === 'Escape') {
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
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-scale-enter-from, .fade-scale-leave-to {
  opacity: 0;
  backdrop-filter: blur(0px);
}
.fade-scale-enter-active .transform {
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-scale-enter-from .transform {
  transform: scale(0.92) translateY(8px);
}
.fade-scale-leave-to .transform {
  transform: scale(0.95);
}

/* Custom Input Focus Ring */
input:focus {
  box-shadow: 0 0 0 4px rgba(var(--color-primary-rgb, 59, 130, 246), 0.1);
}
</style>
