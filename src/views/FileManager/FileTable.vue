<template>
  <div class="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
    <table class="w-full">
      <thead>
        <tr
          class="bg-[var(--bg-muted)]/50 text-left text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase border-b border-[var(--border-color)]"
        >
          <th class="w-12 px-4 py-3">
             <!-- Checkbox column placeholder or Select All -->
          </th>
          <th class="px-4 py-3">{{ t('fileManager.table.name') }}</th>
          <th class="px-4 py-3 w-32">{{ t('fileManager.table.size') }}</th>
          <th class="px-4 py-3 w-24">{{ t('fileManager.table.type') }}</th>
          <th class="px-4 py-3 w-48">{{ t('fileManager.table.uploadedAt') }}</th>
          <th class="px-4 py-3 w-32 text-right">{{ t('fileManager.table.actions') }}</th>
        </tr>
      </thead>
      <TransitionGroup name="list" tag="tbody" class="divide-y divide-[var(--border-color)]">
        <tr
          v-for="file in files"
          :key="file.id"
          class="group cursor-pointer transition-colors duration-200 hover:bg-[var(--bg-hover)]"
          :class="{ 'bg-blue-50/60 dark:bg-blue-900/20': selectedIds.has(file.id) }"
          @click="$emit('toggle-select', file)"
          @contextmenu.prevent="handleContextMenu($event, file)"
        >
          <td class="px-4 py-3">
            <div class="flex items-center justify-center">
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary rounded transition-all"
                :checked="selectedIds.has(file.id)"
                @click.stop="$emit('toggle-select', file)"
              />
            </div>
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <!-- Thumbnail -->
              <div class="relative size-10 shrink-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)]">
                 <img
                  v-if="isImage(file)"
                  :src="file.url"
                  class="size-full object-cover"
                  loading="lazy"
                />
                <div
                  v-else
                  class="text-secondary flex size-full items-center justify-center text-[10px] font-bold uppercase"
                >
                  {{ getFileExtension(file.name) }}
                </div>
              </div>
              
              <!-- Name -->
              <div class="min-w-0 flex-1">
                 <div class="text-primary truncate text-sm font-medium group-hover:text-primary-focus transition-colors">
                    {{ file.originalName || file.name }}
                 </div>
              </div>
            </div>
          </td>
          <td class="text-secondary px-4 py-3 text-sm font-tabular-nums">{{ formatSize(file.size) }}</td>
          <td class="text-secondary px-4 py-3 text-xs uppercase tracking-wide">
            <span class="rounded bg-[var(--bg-muted)] px-1.5 py-0.5">
               {{ getFileExtension(file.name) }}
            </span>
          </td>
          <td class="text-secondary px-4 py-3 text-sm">{{ formatDate(file.createdAt) }}</td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100" :class="{ 'opacity-100': contextMenuOpen }">
              <Tooltip :content="t('fileManager.actions.share')" placement="top">
                <button
                  class="text-secondary hover:bg-[var(--bg-active)] hover:text-primary rounded-lg p-1.5 transition-colors"
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
              </Tooltip>
              
               <Tooltip :content="t('fileManager.actions.move')" placement="top">
                <button
                  class="text-secondary hover:bg-[var(--bg-active)] hover:text-primary rounded-lg p-1.5 transition-colors"
                  @click.stop="$emit('move', file)"
                >
                  <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>
                  </svg>
                </button>
              </Tooltip>

              <Tooltip :content="t('fileManager.actions.delete')" placement="top" danger>
                <button
                  class="text-secondary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg p-1.5 transition-colors"
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
              </Tooltip>
            </div>
          </td>
        </tr>
      </TransitionGroup>
    </table>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useFileManager } from '@/composables/useFileManager';
import Tooltip from '@/components/ui/Tooltip.vue';

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

const contextMenuOpen = ref(false);

const handleContextMenu = (e, file) => {
  emit('context-menu', e, file);
};
</script>
