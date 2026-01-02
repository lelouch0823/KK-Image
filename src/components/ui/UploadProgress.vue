<template>
  <transition name="slide-up">
    <div
      v-if="hasItems"
      class="ease-spring fixed right-6 bottom-6 z-[60] flex max-h-[500px] w-96 flex-col overflow-hidden rounded-2xl border border-white/20 bg-white/90 shadow-2xl backdrop-blur-md transition-all duration-300"
      :class="{ 'w-auto rounded-full': isMinimized }"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-3 select-none"
      >
        <div class="flex items-center gap-3">
          <!-- Progress Ring or Icon -->
          <div class="relative flex size-8 items-center justify-center">
            <svg
              v-if="isUploading"
              class="size-5 animate-spin text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
            >
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <svg
              v-else
              class="size-5 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>

          <div v-if="!isMinimized" class="flex flex-col">
            <span class="text-sm font-semibold text-gray-800">
              {{
                isUploading ? t('upload.uploading', { count: activeCount }) : t('upload.complete')
              }}
            </span>
            <span class="text-xs text-gray-500">
              {{ completedCount }} / {{ queue.length }} {{ t('upload.finished') }}
              <!-- 🔧 NEW: 速度和剩余时间 -->
              <template v-if="isUploading && totalSpeed > 0">
                · {{ formatSpeed(totalSpeed) }}
                <template v-if="estimatedTimeRemaining"
                  >· {{ t('upload.remaining') }} {{ formatTime(estimatedTimeRemaining) }}</template
                >
              </template>
            </span>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex items-center gap-1">
          <button
            v-if="!isMinimized"
            class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            @click.stop="toggleMinimize"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </button>
          <button
            v-else
            class="rounded-full p-2 text-gray-600 transition-colors hover:bg-white/50 hover:text-gray-900"
          >
            <span class="text-xs font-bold">{{ overallProgress }}%</span>
          </button>

          <!-- 🔧 NEW: 重试所有失败 -->
          <button
            v-if="!isMinimized && failedCount > 0"
            class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
            :title="t('common.retryAllFailed')"
            @click.stop="retryAllFailed"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              ></path>
            </svg>
          </button>

          <button
            v-if="!isMinimized && !isUploading"
            class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
            :title="t('upload.clearCompleted')"
            @click.stop="clearCompleted"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </button>
          <button
            v-if="!isMinimized"
            class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
            :title="t('common.clearAll')"
            @click.stop="clearAll"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- File List -->
      <transition name="expand">
        <div
          v-if="!isMinimized"
          class="scrollbar-thin max-h-[300px] flex-1 overflow-y-auto bg-white/50"
        >
          <transition-group name="list" tag="ul" class="space-y-2 p-2">
            <li
              v-for="item in queue"
              :key="item.id"
              class="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md"
            >
              <!-- Icon -->
              <div
                class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500 uppercase"
              >
                {{ item.name.split('.').pop().slice(0, 4) }}
              </div>

              <!-- Info -->
              <div class="min-w-0 flex-1">
                <div class="mb-1 flex items-center justify-between">
                  <h4 class="truncate pr-2 text-sm font-medium text-gray-700" :title="item.name">
                    {{ item.name }}
                  </h4>
                  <span class="shrink-0 font-mono text-xs" :class="getStatusColor(item.status)">
                    {{ getStatusText(item) }}
                  </span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    class="h-full rounded-full transition-all duration-300 ease-out"
                    :class="getProgressBarClass(item.status)"
                    :style="{ width: item.progress + '%' }"
                  ></div>
                </div>
              </div>

              <!-- Action Button -->
              <button
                v-if="item.status === 'error'"
                class="rounded-full border border-gray-100 bg-white p-1.5 text-orange-500 shadow-sm transition-all hover:bg-orange-50 hover:text-orange-700"
                :title="t('upload.retry')"
                @click="retryFile(item.id)"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  ></path>
                </svg>
              </button>
              <button
                v-else-if="item.status !== 'success'"
                class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full border border-gray-100 bg-white p-1.5 text-gray-400 opacity-0 shadow-sm transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                @click="removeFile(item.id)"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
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
import { useI18n } from '@/composables/useI18n';
import { formatDuration } from '@/utils/formatters';

const { t } = useI18n();

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
  clearAll,
} = useUploadQueue();

// 🔧 NEW: 失败数量
const failedCount = computed(() => queue.value.filter((item) => item.status === 'error').length);

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value;
};

const getStatusColor = (status) => {
  switch (status) {
    case 'uploading':
      return 'text-blue-600';
    case 'success':
      return 'text-green-600';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-gray-400';
  }
};

const getProgressBarClass = (status) => {
  switch (status) {
    case 'uploading':
      return 'bg-blue-500';
    case 'success':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-300';
  }
};

const getStatusText = (item) => {
  if (item.status === 'uploading') {
    if (item.speed > 0) {
      return `${item.progress}% · ${formatSpeed(item.speed)}`;
    }
    return `${item.progress}%`;
  }
  if (item.status === 'success') return t('upload.done');
  if (item.status === 'error') return item.error || t('common.failed');
  return t('upload.waiting');
};

// 🔧 NEW: 格式化速度
const formatSpeed = (bytesPerSecond) => {
  if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
};

// 🔧 NEW: 格式化时间
const formatTime = (seconds) => formatDuration(seconds, t);
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
