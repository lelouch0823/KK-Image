<template>
  <TransitionGroup name="list" tag="div" class="space-y-3">
    <div
      v-for="file in files"
      :key="file.id"
      class="group relative flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 shadow-sm transition-all duration-300 active:scale-[0.98] active:bg-[var(--bg-muted)]"
      @click="$emit('preview', file)"
    >
      <!-- Thumbnail -->
      <div
        class="relative size-14 shrink-0 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]"
      >
        <img
          v-if="isImage(file)"
          :src="file.url"
          class="size-full object-cover transition-transform duration-500 group-active:scale-110"
          loading="lazy"
        />
        <div
          v-else
          class="text-secondary flex size-full items-center justify-center text-xs font-bold uppercase tracking-wider"
        >
          {{ getFileExtension(file.name) }}
        </div>
      </div>

      <!-- Info -->
      <div class="min-w-0 flex-1 py-0.5">
        <h4 class="text-primary truncate text-sm font-semibold leading-tight">
          {{ file.originalName || file.name }}
        </h4>
        <div class="text-secondary mt-1 flex items-center gap-2 text-xs">
          <span>{{ formatSize(file.size) }}</span>
          <span class="size-0.5 rounded-full bg-current opacity-50"></span>
          <span>{{ formatDate(file.createdAt) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-1">
        <button
          class="text-secondary flex size-8 items-center justify-center rounded-lg transition-colors active:bg-[var(--bg-active)] active:text-primary"
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
          class="text-secondary flex size-8 items-center justify-center rounded-lg transition-colors active:bg-[var(--bg-active)] active:text-primary"
          @click.stop="$emit('context-menu', $event, file)"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
          </svg>
        </button>
      </div>
    </div>
  </TransitionGroup>
</template>

<script setup>
import { useFileManager } from '@/composables/useFileManager';

defineProps({
  files: {
    type: Array,
    required: true,
  },
});

defineEmits(['share', 'delete', 'context-menu', 'preview']);

const { formatSize, formatDate, getFileExtension, isImage } = useFileManager();
</script>
