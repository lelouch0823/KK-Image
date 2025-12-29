<template>
  <div class="relative inline-block text-left" ref="container">
    <button 
      @click="toggle"
      class="inline-flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/20"
      :class="currentStatusClass"
    >
      <span>{{ t(`order.statuses.${status}`) }}</span>
      <svg class="w-4 h-4 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </button>

    <!-- 下拉菜单 -->
    <div 
      v-if="isOpen" 
      class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden animate-fade-in origin-top-right ring-1 ring-black ring-opacity-5"
    >
      <div class="p-2 border-b border-gray-50 bg-gray-50/50">
        <h4 class="text-xs font-medium text-gray-500 px-2">{{ t('order.manage.changeStatus') }}</h4>
      </div>
      
      <div class="py-1 max-h-64 overflow-y-auto">
        <button
          v-for="s in statusOptions"
          :key="s"
          @click="selectStatus(s)"
          class="w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors group"
          :class="{'bg-primary/5 text-primary': s === status}"
        >
          <span 
            class="flex items-center gap-2"
            :class="{'font-medium': s === status}"
          >
            <span class="w-2 h-2 rounded-full" :class="getStatusDotColor(s)"></span>
            {{ t(`order.statuses.${s}`) }}
          </span>
          <svg v-if="s === status" class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- 确认弹窗 -->
    <div v-if="pendingStatus" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" @click.self="cancelChange">
      <div class="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6 animate-scale-in">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ t('order.manage.confirmStatusChange') }}</h3>
        <p class="text-sm text-gray-600 mb-4">
          {{ t('order.timeline.statusChanged') }} 
          <span class="font-medium text-gray-900 mx-1">
            {{ t(`order.statuses.${status}`) }}
          </span>
          →
          <span class="font-medium text-primary mx-1">
            {{ t(`order.statuses.${pendingStatus}`) }}
          </span>
        </p>

        <!-- 备注 -->
        <div class="mb-6">
          <label class="block text-xs font-medium text-gray-500 mb-1">
            {{ t('order.manage.statusNote') }}
          </label>
          <input 
            v-model="statusNote"
            type="text"
            :placeholder="t('order.manage.statusNotePlaceholder')"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none"
            @keyup.enter="confirmChange"
          >
        </div>

        <div class="flex gap-3">
          <button 
            @click="cancelChange" 
            class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button 
            @click="confirmChange"
            class="flex-1 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <svg v-if="submitting" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  status: { type: String, required: true },
  loading: Boolean
});

const emit = defineEmits(['change']);

const { t } = useI18n();

const isOpen = ref(false);
const container = ref(null);
const pendingStatus = ref(null);
const statusNote = ref('');
const submitting = ref(false);

const statusOptions = ['pending', 'confirmed', 'rejected', 'production', 'shipping', 'arrived', 'delivered'];

const statusStyles = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  rejected: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
  production: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  shipping: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
  arrived: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  delivered: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
};

const statusDots = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  rejected: 'bg-red-500',
  production: 'bg-purple-500',
  shipping: 'bg-cyan-500',
  arrived: 'bg-green-500',
  delivered: 'bg-gray-500'
};

const currentStatusClass = computed(() => statusStyles[props.status] || statusStyles.pending);

const getStatusDotColor = (s) => statusDots[s] || 'bg-gray-400';

const toggle = () => {
  if (!props.loading) {
    isOpen.value = !isOpen.value;
  }
};

const selectStatus = (s) => {
  if (s === props.status) return;
  pendingStatus.value = s;
  isOpen.value = false;
  statusNote.value = '';
};

const cancelChange = () => {
  pendingStatus.value = null;
  statusNote.value = '';
};

const confirmChange = async () => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await emit('change', {
      status: pendingStatus.value,
      note: statusNote.value
    });
    pendingStatus.value = null;
  } finally {
    submitting.value = false;
  }
};

// 点击外部关闭
const handleClickOutside = (e) => {
  if (container.value && !container.value.contains(e.target)) {
    isOpen.value = false;
  }
};

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.15s ease-out;
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-scale-in {
  animation: scale-in 0.2s ease-out;
}
</style>
