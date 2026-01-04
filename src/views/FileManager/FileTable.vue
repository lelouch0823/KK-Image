<template>
  <table class="w-full">
    <thead>
      <tr
        class="text-secondary border-b border-[var(--border-color)] text-left text-xs font-medium tracking-wider uppercase"
      >
        <th class="w-10 px-4 py-3">
          <!-- Header Checkbox could go here if we want select all visible -->
        </th>
        <th class="px-4 py-3">{{ t('fileManager.table.name') }}</th>
        <th class="px-4 py-3">{{ t('fileManager.table.size') }}</th>
        <th class="px-4 py-3">{{ t('fileManager.table.type') }}</th>
        <th class="px-4 py-3">{{ t('fileManager.table.uploadedAt') }}</th>
        <th class="px-4 py-3 text-right">{{ t('fileManager.table.actions') }}</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-[var(--border-color)]">
      <tr
        v-for="file in files"
        :key="file.id"
        class="group transition-colors hover:bg-[var(--bg-hover)]"
        :class="{ 'bg-blue-50/50': selectedIds.has(file.id) }"
        @click="$emit('toggle-select', file)"
        @contextmenu.prevent="handleContextMenu($event, file)"
      >
        <td class="px-4 py-3">
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary rounded"
            :checked="selectedIds.has(file.id)"
            @click.stop="$emit('toggle-select', file)"
          />
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <img
              v-if="isImage(file)"
              :src="file.url"
              class="size-8 rounded border border-[var(--border-color)] bg-gray-50 object-cover"
              loading="lazy"
            />
            <div
              v-else
              class="text-secondary flex size-8 items-center justify-center rounded border border-[var(--border-color)] bg-gray-100 text-xs uppercase"
            >
              {{ getFileExtension(file.name) }}
            </div>
            <a
              :href="file.url"
              target="_blank"
              class="text-primary max-w-[200px] truncate text-sm font-medium hover:underline"
              :title="file.originalName"
              @click.stop
              >{{ file.originalName || file.name }}</a
            >
          </div>
        </td>
        <td class="text-secondary px-4 py-3 text-sm">{{ formatSize(file.size) }}</td>
        <td class="text-secondary px-4 py-3 text-sm uppercase">
          {{ getFileExtension(file.name) }}
        </td>
        <td class="text-secondary px-4 py-3 text-sm">{{ formatDate(file.createdAt) }}</td>
        <td class="px-4 py-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <button
              class="text-secondary rounded-lg p-1.5 transition-colors hover:text-primary hover:bg-gray-100"
              :title="t('fileManager.actions.share')"
              @click.stop="$emit('share', file)"
            >
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                ></path>
              </svg>
            </button>
            <button
              class="text-secondary rounded-lg p-1.5 transition-colors hover:text-primary hover:bg-gray-100"
              :title="t('fileManager.actions.move')"
              @click.stop="$emit('move', file)"
            >
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                ></path>
              </svg>
            </button>
            <button
              class="text-secondary rounded-lg p-1.5 transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
              :title="t('fileManager.actions.delete')"
              @click.stop="$emit('delete', file)"
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
    required: true,
  },
  selectedIds: {
    type: Set,
    default: () => new Set(),
  },
});

const emit = defineEmits(['share', 'move', 'delete', 'context-menu', 'select', 'toggle-select']);

const { t } = useI18n();
const { formatSize, formatDate, getFileExtension, isImage } = useFileManager();

const handleContextMenu = (e, file) => {
  emit('context-menu', e, file);
};
</script>
