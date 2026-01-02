<template>
  <div class="space-y-2">
    <div
      v-for="file in files"
      :key="file.id"
      class="flex items-center gap-3 rounded-xl bg-gray-50 p-3"
    >
      <!-- 缩略图 -->
      <div
        class="size-12 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-gray-100"
      >
        <img v-if="isImage(file)" :src="file.url" class="size-full object-cover" loading="lazy" />
        <div
          v-else
          class="text-secondary flex size-full items-center justify-center text-xs font-medium uppercase"
        >
          {{ getFileExtension(file.name) }}
        </div>
      </div>

      <!-- 文件信息 -->
      <div class="min-w-0 flex-1">
        <a
          :href="file.url"
          target="_blank"
          class="text-primary block truncate text-sm font-medium hover:underline"
        >
          {{ file.originalName || file.name }}
        </a>
        <div class="text-secondary mt-0.5 text-xs">
          {{ formatSize(file.size) }} · {{ formatDate(file.createdAt) }}
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center gap-1">
        <button
          class="text-secondary rounded-lg p-2 hover:text-primary"
          @click="$emit('share', file)"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            ></path>
          </svg>
        </button>
        <button
          class="text-secondary rounded-lg p-2 hover:text-[var(--color-danger)]"
          @click="$emit('delete', file)"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            ></path>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useFileManager } from '@/composables/useFileManager';

defineProps({
  files: {
    type: Array,
    required: true,
  },
});

defineEmits(['share', 'delete']);

const { formatSize, formatDate, getFileExtension, isImage } = useFileManager();
</script>
