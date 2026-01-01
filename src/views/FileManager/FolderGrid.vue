<template>
  <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
    <div 
      v-for="folder in folders" 
      :key="folder.id"
      @click="$emit('navigate', folder.id)"
      class="group bg-white border border-[var(--border-color)] rounded-xl p-4 hover:shadow-md transition-all cursor-pointer relative hover:border-gray-300"
    >
      <div class="flex flex-col items-center">
        <svg class="w-16 h-16 text-[var(--color-warning)] mb-2 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
        </svg>
        <div class="text-sm font-medium text-primary text-center truncate w-full px-2" :title="folder.name">{{ folder.name }}</div>
        <div class="text-xs text-secondary mt-1">{{ (folder.fileCount || 0) + (folder.subfolderCount || 0) }} {{ t('common.items') }}</div>
      </div>

      <!-- Delete Button on Hover -->
      <button 
        @click.stop="$emit('delete', folder)"
        class="absolute top-2 right-2 p-1.5 bg-white shadow-sm border border-gray-100 rounded-lg text-secondary hover:text-[var(--color-danger)] opacity-0 group-hover:opacity-100 transition-all z-10"
        :title="t('common.delete')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';

defineProps({
  folders: {
    type: Array,
    required: true
  }
});

defineEmits(['navigate']);

const { t } = useI18n();
</script>
