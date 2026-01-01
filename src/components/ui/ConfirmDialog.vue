<template>
  <Teleport to="body">
    <transition name="fade-scale">
      <div v-if="modelValue" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all border border-gray-100"
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
          <h3 class="text-xl font-bold text-gray-900 mb-2">{{ title }}</h3>
          <p class="text-gray-500 text-sm leading-relaxed">
            <slot>{{ message }}</slot>
          </p>
        </div>

        <!-- 操作按钮 -->
        <div class="px-6 pb-6 flex items-center gap-3">
          <button 
            @click="handleCancel"
            :disabled="loading"
            class="flex-1 py-2.5 px-4 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
          >
            {{ cancelText }}
          </button>
          <button 
            @click="handleConfirm"
            :disabled="loading"
            :class="[
              'flex-1 py-2.5 px-4 text-sm font-semibold text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2',
              typeClasses.btn,
              loading ? 'opacity-70 cursor-not-allowed' : ''
            ]"
          >
            <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ confirmText }}
          </button>
        </div>
      </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';

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
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  type: {
    type: String, // 'primary' | 'danger' | 'warning' | 'success' | 'info'
    default: 'primary'
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

// Type-based styling
const typeClasses = computed(() => {
  const types = {
    primary: {
      bg: 'bg-primary/5',
      accent: 'bg-primary',
      iconBg: 'bg-primary/10',
      iconText: 'text-primary',
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

const handleCancel = () => {
  if (props.loading) return;
  emit('update:modelValue', false);
  emit('cancel');
};

const handleConfirm = () => {
  if (props.loading) return;
  emit('confirm');
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
