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
                ? 'border-primary bg-primary text-(--text-inverse)'
                : 'border-(--border-color) bg-(--bg-card) group-hover:border-(--text-secondary)',
            ]"
            @click.stop="$emit('toggle', row)"
          >
            <AppIcon v-if="selectedIds.has(row.id)" name="check" class="size-3.5" />
          </div>

          <!-- Thumbnail -->
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--bg-muted) text-(--text-secondary)"
          >
            <AppImage
              v-if="isImage(row)"
              :src="row.url"
              :alt="row.originalName || row.name"
              class="size-full"
              fit="cover"
            />
            <AppIcon v-else name="document" class="size-5" />
          </div>

          <!-- Name -->
          <span class="max-w-[200px] truncate font-medium text-(--text-main) sm:max-w-xs">
            {{ row.originalName || row.name }}
          </span>
        </div>
      </template>

      <template #cell-size="{ value }">
        <span class="font-mono text-(--text-secondary)">{{ formatSize(value) }}</span>
      </template>

      <template #cell-type="{ value }">
        <span
          class="inline-flex rounded bg-(--bg-muted) px-2 py-0.5 text-xs text-(--text-secondary) uppercase"
        >
          {{ value?.split('/')[1] || 'FILE' }}
        </span>
      </template>

      <template #cell-createdAt="{ value }">
        <span class="text-(--text-muted)">{{ formatDate(value) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <AppButton
            variant="ghost"
            size="sm"
            class="!size-8 !p-1.5"
            :title="t('fileManager.actions.share')"
            @click.stop="$emit('share', row)"
          >
            <template #icon-left>
              <AppIcon name="share" class="size-4" />
            </template>
          </AppButton>
          <AppButton
            variant="ghost"
            size="sm"
            class="!size-8 !p-1.5"
            @click.stop="$emit('context-menu', $event, row)"
          >
            <template #icon-left>
              <AppIcon name="ellipsis-vertical" class="size-4" />
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
import AppIcon from '@/components/ui/AppIcon.vue';
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

defineEmits([
  'share',
  'move',
  'delete',
  'context-menu',
  'select',
  'toggle-select',
  'preview',
  'toggle',
]);

const { t } = useI18n();
const { formatSize, formatDate, isImage } = useFileManager();

const columns = computed(() => [
  { key: 'name', label: t('fileManager.table.name') },
  {
    key: 'size',
    label: t('fileManager.table.size'),
    headerClass: 'hidden sm:table-cell',
    cellClass: 'hidden sm:table-cell',
  },
  {
    key: 'type',
    label: t('fileManager.table.type'),
    headerClass: 'hidden md:table-cell',
    cellClass: 'hidden md:table-cell',
  },
  {
    key: 'createdAt',
    label: t('fileManager.table.uploadedAt'),
    headerClass: 'hidden lg:table-cell',
    cellClass: 'hidden lg:table-cell',
  },
  { key: 'actions', label: t('fileManager.table.actions'), align: 'right' },
]);
</script>
