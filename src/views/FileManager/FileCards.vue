<template>
  <div class="space-y-2">
    <div
      v-for="file in files"
      :key="file.id"
      class="flex items-center gap-3 rounded-xl bg-[var(--bg-muted)] p-3 transition-all duration-300 hover:bg-[var(--bg-card)] hover:shadow-soft hover:-translate-y-0.5 border border-transparent hover:border-[var(--border-color)]"
    >
      <!-- 缩略图 -->
      <div
        class="size-12 shrink-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)]"
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
          class="text-secondary rounded-lg p-2 transition-colors hover:text-primary active:bg-[var(--bg-active)]"
          @click.stop="$emit('share', file)"
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
          class="text-secondary rounded-lg p-2 transition-colors hover:text-primary active:bg-[var(--bg-active)]"
          @click.stop="$emit('context-menu', $event, file)"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
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

defineEmits(['share', 'delete', 'context-menu']);

const { formatSize, formatDate, getFileExtension, isImage } = useFileManager();
</script>
