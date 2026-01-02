<template>
  <div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    <div
      v-for="folder in folders"
      :key="folder.id"
      class="group relative cursor-pointer rounded-xl border border-[var(--border-color)] bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md"
      @click="$emit('navigate', folder.id)"
    >
      <div class="flex flex-col items-center">
        <svg
          class="mb-2 size-16 text-[var(--color-warning)] transition-transform group-hover:scale-110"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
        </svg>
        <div
          class="text-primary w-full truncate px-2 text-center text-sm font-medium"
          :title="folder.name"
        >
          {{ folder.name }}
        </div>
        <div class="text-secondary mt-1 text-xs">
          {{ (folder.fileCount || 0) + (folder.subfolderCount || 0) }} {{ t('common.items') }}
        </div>
      </div>

      <!-- Delete Button on Hover -->
      <button
        class="text-secondary absolute top-2 right-2 z-10 rounded-lg border border-gray-100 bg-white p-1.5 opacity-0 shadow-sm transition-all group-hover:opacity-100 hover:text-[var(--color-danger)]"
        :title="t('common.delete')"
        @click.stop="$emit('delete', folder)"
      >
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';

defineProps({
  folders: {
    type: Array,
    required: true,
  },
});

defineEmits(['navigate', 'select', 'delete']);

const { t } = useI18n();
</script>
