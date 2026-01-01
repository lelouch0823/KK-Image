<template>
  <transition name="fade-scale">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all border border-gray-100"
        @click.stop
      >
        <!-- 图标/背景装饰 -->
        <div :class="[
          'h-24 flex items-center justify-center relative overflow-hidden',
          type === 'danger' ? 'bg-red-50' : 'bg-primary/5'
        ]">
          <div class="absolute inset-0 opacity-10 blur-2xl transform scale-150 rotate-12" :class="type === 'danger' ? 'bg-red-500' : 'bg-primary'"></div>
          
          <div :class="[
            'w-14 h-14 rounded-full flex items-center justify-center relative z-10',
            type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'
          ]">
            <svg v-if="type === 'danger'" class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <svg v-else class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
              type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-primary hover:bg-primary-hover shadow-primary/20',
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
</template>

<script setup>
import { computed } from 'vue';

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
    type: String, // 'primary' | 'danger'
    default: 'primary'
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

const handleCancel = () => {
  if (props.loading) return;
  emit('update:modelValue', false);
  emit('cancel');
};

const handleConfirm = () => {
  if (props.loading) return;
  emit('confirm');
};
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
