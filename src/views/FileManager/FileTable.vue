<template>
  <div class="h-full">
    <AppTable
      :columns="columns"
      :data="files"
      row-key="id"
      :empty-text="t('fileManager.emptyFolder')"
      :virtual="files.length > 50"
      :estimate-size="64"
      no-border
      @row-click="$emit('preview', $event)"
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <!-- Checkbox -->
          <div 
            class="flex size-5 shrink-0 items-center justify-center rounded border transition-colors"
            :class="[
              selectedIds.has(row.id)
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--text-inverse)]'
                : 'border-[var(--border-color)] bg-[var(--bg-card)] group-hover:border-[var(--text-secondary)]'
            ]"
            @click.stop="$emit('toggle', row)"
          >
            <svg v-if="selectedIds.has(row.id)" class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <!-- Thumbnail -->
          <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-secondary)]">
            <AppImage
              v-if="isImage(row)"
              :src="row.url"
              class="size-full"
              fit="cover"
            />
            <svg v-else class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>

          <!-- Name -->
          <span class="max-w-[200px] truncate font-medium text-[var(--text-main)] sm:max-w-xs">
            {{ row.originalName || row.name }}
          </span>
        </div>
      </template>

      <template #cell-size="{ value }">
        <span class="font-mono text-[var(--text-secondary)]">{{ formatSize(value) }}</span>
      </template>

      <template #cell-type="{ value }">
        <span class="inline-flex rounded bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)] uppercase">
          {{ value?.split('/')[1] || 'FILE' }}
        </span>
      </template>

      <template #cell-createdAt="{ value }">
        <span class="text-[var(--text-muted)]">{{ formatDate(value) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <AppButton
            variant="ghost"
            size="sm"
            class="!size-8  !p-1.5"
            :title="t('fileManager.actions.share')"
            @click.stop="$emit('share', row)"
          >
            <template #icon-left>
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </template>
          </AppButton>
          <AppButton
            variant="ghost"
            size="sm"
            class="!size-8  !p-1.5"
            @click.stop="$emit('context-menu', $event, row)"
          >
            <template #icon-left>
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </template>
          </AppButton>
        </div>
      </template>
    </AppTable>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useFileManager } from '@/composables/useFileManager';
import AppTable from '@/components/ui/AppTable.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppImage from '@/components/ui/AppImage.vue';

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

defineEmits(['share', 'move', 'delete', 'context-menu', 'select', 'toggle-select', 'preview', 'toggle']);

const { t } = useI18n();
const { formatSize, formatDate, isImage } = useFileManager();

const columns = computed(() => [
  { key: 'name', label: t('fileManager.table.name') },
  { key: 'size', label: t('fileManager.table.size'), class: 'hidden sm:table-cell' },
  { key: 'type', label: t('fileManager.table.type'), class: 'hidden md:table-cell' },
  { key: 'createdAt', label: t('fileManager.table.uploadedAt'), class: 'hidden lg:table-cell' },
  { key: 'actions', label: t('fileManager.table.actions'), align: 'right' },
]);
</script>
