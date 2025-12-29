<template>
  <div class="space-y-2">
    <div 
      v-for="file in files" 
      :key="file.id"
      class="bg-gray-50 rounded-xl p-3 flex items-center gap-3"
    >
      <!-- 缩略图 -->
      <div class="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-[var(--border-color)]">
        <img v-if="isImage(file)" :src="file.url" class="w-full h-full object-cover" loading="lazy">
        <div v-else class="w-full h-full flex items-center justify-center text-xs text-secondary uppercase font-medium">
          {{ getFileExtension(file.name) }}
        </div>
      </div>
      
      <!-- 文件信息 -->
      <div class="flex-1 min-w-0">
        <a :href="file.url" target="_blank" class="text-sm font-medium text-primary truncate block hover:underline">
          {{ file.originalName || file.name }}
        </a>
        <div class="text-xs text-secondary mt-0.5">
          {{ formatSize(file.size) }} · {{ formatDate(file.createdAt) }}
        </div>
      </div>
      
      <!-- 操作按钮 -->
      <div class="flex items-center gap-1">
        <button @click="$emit('share', file)" class="p-2 text-secondary hover:text-primary rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
        </button>
        <button @click="$emit('delete', file)" class="p-2 text-secondary hover:text-[var(--color-danger)] rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
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
    required: true
  }
});

defineEmits(['share', 'delete']);

const { formatSize, formatDate, getFileExtension, isImage } = useFileManager();
</script>
