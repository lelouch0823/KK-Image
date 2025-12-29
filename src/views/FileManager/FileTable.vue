<template>
  <table class="w-full">
    <thead>
      <tr class="text-left text-xs font-medium text-secondary uppercase tracking-wider border-b border-[var(--border-color)]">
        <th class="px-4 py-3">{{ t('fileManager.table.name') }}</th>
        <th class="px-4 py-3">{{ t('fileManager.table.size') }}</th>
        <th class="px-4 py-3">{{ t('fileManager.table.type') }}</th>
        <th class="px-4 py-3">{{ t('fileManager.table.uploadedAt') }}</th>
        <th class="px-4 py-3 text-right">{{ t('fileManager.table.actions') }}</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-[var(--border-color)]">
      <tr v-for="file in files" :key="file.id" class="hover:bg-[var(--bg-hover)] group transition-colors">
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <img v-if="isImage(file)" :src="file.url" class="w-8 h-8 rounded object-cover border border-[var(--border-color)] bg-gray-50" loading="lazy">
            <div v-else class="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs text-secondary uppercase border border-[var(--border-color)]">
              {{ getFileExtension(file.name) }}
            </div>
            <a :href="file.url" target="_blank" class="text-sm font-medium text-primary truncate max-w-[200px] hover:underline" :title="file.originalName">{{ file.originalName || file.name }}</a>
          </div>
        </td>
        <td class="px-4 py-3 text-sm text-secondary">{{ formatSize(file.size) }}</td>
        <td class="px-4 py-3 text-sm text-secondary uppercase">{{ getFileExtension(file.name) }}</td>
        <td class="px-4 py-3 text-sm text-secondary">{{ formatDate(file.createdAt) }}</td>
        <td class="px-4 py-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <button @click="$emit('share', file)" class="p-1.5 text-secondary hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" :title="t('fileManager.actions.share')">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            </button>
            <button @click="$emit('move', file)" class="p-1.5 text-secondary hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" :title="t('fileManager.actions.move')">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>
            </button>
            <button @click="$emit('delete', file)" class="p-1.5 text-secondary hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded-lg transition-colors" :title="t('fileManager.actions.delete')">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { useFileManager } from '@/composables/useFileManager';

defineProps({
  files: {
    type: Array,
    required: true
  }
});

defineEmits(['share', 'move', 'delete']);

const { t } = useI18n();
const { formatSize, formatDate, getFileExtension, isImage } = useFileManager();
</script>
