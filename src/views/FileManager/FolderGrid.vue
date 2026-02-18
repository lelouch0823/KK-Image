<template>
  <TransitionGroup name="list" tag="div" class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    <div
      v-for="folder in folders"
      :key="folder.id"
      class="group relative cursor-pointer rounded-xl border p-3 transition-all hover:shadow-md active:scale-[0.98] sm:p-4"
      :class="[
        selectedIds.has(folder.id)
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)] dark:bg-[var(--color-primary)]/20'
          : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--border-hover)]'
      ]"
      @click="$emit('navigate', folder.id)"
      @contextmenu.prevent.stop="handleContextMenu($event, folder)"
    >
      <div class="flex flex-col items-center">
        <!-- 文件夹图标: 移动端 size-12, 桌面端 size-16 -->
        <svg
          class="mb-2 size-12 text-[var(--color-warning)] transition-transform group-hover:scale-110 sm:size-14 lg:size-16"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
        </svg>
        <!-- 文件夹名称 -->
        <div
          class="w-full truncate px-1 text-center text-xs font-medium text-[var(--color-primary)] sm:px-2 sm:text-sm"
          :title="folder.name"
        >
          {{ folder.name }}
        </div>
        <!-- 项目数量 -->
        <div class="mt-0.5 text-[10px] text-[var(--text-secondary)] sm:mt-1 sm:text-xs">
          {{ (folder.fileCount || 0) + (folder.subfolderCount || 0) }} {{ t('common.items') }}
        </div>
      </div>

      <!-- More Actions Button -->
      <button
        class="text-secondary absolute top-1.5 right-1.5 z-10 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-sm transition-all hover:text-primary sm:top-2 sm:right-2 sm:p-1.5 lg:opacity-0 lg:group-hover:opacity-100"
        @click.stop="$emit('context-menu', $event, folder)"
      >
        <svg class="size-3.5 sm:size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
        </svg>
      </button>
    </div>
  </TransitionGroup>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';

defineProps({
  folders: {
    type: Array,
    required: true,
  },
  selectedIds: {
    type: Set,
    default: () => new Set(),
  },
});

const emit = defineEmits(['navigate', 'select', 'delete', 'context-menu']);

const { t } = useI18n();

const handleContextMenu = (e, folder) => {
  emit('context-menu', e, folder);
};
</script>
