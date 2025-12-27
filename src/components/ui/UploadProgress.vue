<template>
  <transition name="slide-up">
    <div v-if="hasItems" class="fixed bottom-6 right-6 w-96 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 overflow-hidden z-[60] flex flex-col max-h-[500px] transition-all duration-300 ease-spring"
      :class="{ 'w-auto rounded-full': isMinimized }">
      
      <!-- Header -->
      <div class="px-4 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between select-none">
        <div class="flex items-center gap-3">
           <!-- Progress Ring or Icon -->
           <div class="relative w-8 h-8 flex items-center justify-center">
             <svg v-if="isUploading" class="animate-spin w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
             <svg v-else class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
             </svg>
           </div>
           
           <div v-if="!isMinimized" class="flex flex-col">
              <span class="text-sm font-semibold text-gray-800">
                {{ isUploading ? `正在上传 ${activeCount} 个文件` : '上传完成' }}
              </span>
              <span class="text-xs text-gray-500">
                {{ completedCount }} / {{ queue.length }} 完成
                <!-- 🔧 NEW: 速度和剩余时间 -->
                <template v-if="isUploading && totalSpeed > 0">
                  · {{ formatSpeed(totalSpeed) }}
                  <template v-if="estimatedTimeRemaining">· 剩余 {{ formatTime(estimatedTimeRemaining) }}</template>
                </template>
              </span>
           </div>
        </div>

        <!-- Controls -->
        <div class="flex items-center gap-1">
          <button v-if="!isMinimized" @click.stop="toggleMinimize" class="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          <button v-else class="p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-white/50 transition-colors">
             <span class="text-xs font-bold">{{ overallProgress }}%</span>
          </button>
          
          <!-- 🔧 NEW: 重试所有失败 -->
          <button v-if="!isMinimized && failedCount > 0" @click.stop="retryAllFailed" class="p-1.5 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors" title="重试所有失败">
             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
             </svg>
          </button>

          <button v-if="!isMinimized && !isUploading" @click.stop="clearCompleted" class="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors" title="清除已完成">
             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
             </svg>
          </button>
           <button v-if="!isMinimized" @click.stop="clearAll" class="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="全部取消">
             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
             </svg>
          </button>
        </div>
      </div>

      <!-- File List -->
      <transition name="expand">
        <div v-if="!isMinimized" class="flex-1 overflow-y-auto max-h-[300px] scrollbar-thin bg-white/50">
          <transition-group name="list" tag="ul" class="p-2 space-y-2">
            <li v-for="item in queue" :key="item.id" 
                class="group flex items-center gap-3 p-3 bg-white hover:bg-gray-50 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md relative overflow-hidden">

               <!-- Icon -->
               <div class="w-10 h-10 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-bold uppercase">
                  {{ item.name.split('.').pop().slice(0, 4) }}
               </div>

               <!-- Info -->
               <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                      <h4 class="text-sm font-medium text-gray-700 truncate pr-2" :title="item.name">{{ item.name }}</h4>
                      <span class="text-xs font-mono shrink-0" :class="getStatusColor(item.status)">
                        {{ getStatusText(item) }}
                      </span>
                  </div>
                  <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                     <div class="h-full rounded-full transition-all duration-300 ease-out"
                          :class="getProgressBarClass(item.status)"
                          :style="{ width: item.progress + '%' }">
                     </div>
                  </div>
               </div>

               <!-- Action Button -->
               <button v-if="item.status === 'error'" @click="retryFile(item.id)" 
                  class="p-1.5 text-orange-500 hover:text-orange-700 rounded-full hover:bg-orange-50 transition-all bg-white shadow-sm border border-gray-100" title="重试">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
               </button>
               <button v-else-if="item.status !== 'success'" @click="removeFile(item.id)" 
                  class="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-all absolute right-2 top-1/2 -translate-y-1/2 bg-white shadow-sm border border-gray-100">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
               </button>
            </li>
          </transition-group>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue';
import { useUploadQueue } from '@/composables/useUploadQueue';

const { 
    queue, 
    isUploading, 
    hasItems, 
    activeCount, 
    completedCount, 
    overallProgress,
    isMinimized,
    totalSpeed,
    estimatedTimeRemaining,
    removeFile,
    retryFile,
    retryAllFailed,
    clearCompleted,
    clearAll
} = useUploadQueue();

// 🔧 NEW: 失败数量
const failedCount = computed(() => queue.value.filter(item => item.status === 'error').length);

const toggleMinimize = () => {
    isMinimized.value = !isMinimized.value;
};

const getStatusColor = (status) => {
    switch (status) {
        case 'uploading': return 'text-blue-600';
        case 'success': return 'text-green-600';
        case 'error': return 'text-red-600';
        default: return 'text-gray-400';
    }
};

const getProgressBarClass = (status) => {
    switch (status) {
        case 'uploading': return 'bg-blue-500';
        case 'success': return 'bg-green-500';
        case 'error': return 'bg-red-500';
        default: return 'bg-gray-300';
    }
};

const getStatusText = (item) => {
    if (item.status === 'uploading') {
        // 🔧 NEW: 显示速度
        if (item.speed > 0) {
            return `${item.progress}% · ${formatSpeed(item.speed)}`;
        }
        return `${item.progress}%`;
    }
    if (item.status === 'success') return '完成';
    if (item.status === 'error') return item.error || '失败';
    return '等待';
};

// 🔧 NEW: 格式化速度
const formatSpeed = (bytesPerSecond) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
};

// 🔧 NEW: 格式化时间
const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`;
};
</script>

<style scoped>
.ease-spring {
    transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
}

.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.list-leave-active {
  position: absolute;
  right: 12px;
  left: 12px;
}

.expand-enter-active,
.expand-leave-active {
    transition: all 0.3s ease;
    max-height: 300px;
    opacity: 1;
}
.expand-enter-from,
.expand-leave-to {
    max-height: 0;
    opacity: 0;
}
</style>
