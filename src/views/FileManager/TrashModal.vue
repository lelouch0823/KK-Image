<template>
  <Modal
    v-model="visible"
    :title="t('trash.title')"
    size="5xl"
    :close-on-backdrop="true"
    body-class="p-0 flex flex-col h-[70vh]"
  >
    <div class="flex h-full flex-col bg-(--bg-default)">
      <!-- 头部工具栏 -->
      <div
        class="flex h-16 shrink-0 items-center justify-between border-b border-(--border-color) px-6"
      >
        <div class="flex items-center gap-3">
          <div v-if="files.length > 0" class="text-sm text-(--text-muted)">
            {{ t('fileManager.totalFiles', { count: files.length }) }}
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- 批量操作 -->
          <transition name="fade">
            <div v-if="selectedIds.length > 0" class="flex items-center gap-2">
              <span class="mr-2 text-sm text-(--text-muted)">
                {{ t('fileManager.selected', { count: selectedIds.length }) }}
              </span>
              <AppButton
                variant="outline"
                size="sm"
                class="text-primary hover:bg-(--color-primary-bg) hover:text-primary"
                :disabled="loading"
                @click="handleRestoreSelected"
              >
                <template #icon-left>
                  <AppIcon name="arrow-path" class="size-4" />
                </template>
                {{ t('trash.restore') }}
              </AppButton>
              <AppButton
                variant="danger"
                size="sm"
                :disabled="loading"
                @click="requestDeleteSelected"
              >
                <template #icon-left>
                  <AppIcon name="trash" class="size-4" />
                </template>
                {{ t('trash.deleteForever') }}
              </AppButton>
            </div>
          </transition>

          <!-- 清空回收站 -->
          <AppButton
            v-if="files.length > 0"
            variant="outline"
            size="sm"
            class="group border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
            :disabled="loading || selectedIds.length > 0"
            @click="showEmptyConfirm = true"
          >
            <template #icon-left>
              <AppIcon
                class="size-4 transition-transform duration-300 group-hover:rotate-12"
                name="trash"
              />
            </template>
            {{ t('trash.emptyTrash') }}
          </AppButton>
        </div>
      </div>

      <!-- 主要内容区域 -->
      <div class="flex-1 overflow-hidden p-6">
        <!-- Loading 状态 -->
        <div v-if="loading" class="flex h-full items-center justify-center">
          <div
            class="border-primary size-10 animate-spin rounded-full border-2 border-t-transparent"
          ></div>
        </div>

        <!-- 空状态 -->
        <div
          v-else-if="files.length === 0"
          class="animate-in fade-in zoom-in flex h-full flex-col items-center justify-center text-center duration-500"
        >
          <div class="relative mb-6">
            <div
              class="absolute -inset-4 rounded-full bg-(--color-success-bg) opacity-70 blur-xl"
            ></div>
            <AppIcon class="relative size-32 text-(--text-muted)/20" name="check-circle" />
          </div>
          <h3 class="mb-2 text-xl font-medium text-(--text-primary)">
            {{ t('trash.empty') }}
          </h3>
          <p class="text-(--text-secondary)">{{ t('trash.emptyDesc') }}</p>
        </div>

        <!-- 文件列表 -->
        <div v-else class="h-full overflow-hidden">
          <AppTable
            :columns="columns"
            :data="files"
            :row-class="getRowClass"
            table-layout="fixed"
            @row-click="toggleSelection"
          >
            <template #header-selection>
              <AppCheckbox :checked="isAllSelected" @change="toggleSelectAll" />
            </template>
            <template #cell-selection="{ row: file }">
              <AppCheckbox v-model="selectedIds" :value="file.id" @click.stop />
            </template>
            <template #cell-name="{ row: file }">
              <div class="flex items-center gap-3">
                <!-- 图标 (Grayscale filter) -->
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded bg-(--bg-muted) text-(--text-muted) opacity-80 grayscale"
                >
                  <AppImage
                    v-if="isImage(file.name) && file.thumbnail"
                    :src="file.thumbnail"
                    :blurhash="file.blurhash"
                    class="size-full"
                    fit="cover"
                    rounded="sm"
                  />
                  <AppIcon v-else-if="file.type === 'folder'" class="size-5" name="folder" />
                  <AppIcon v-else class="size-5" name="document" />
                </div>
                <div class="min-w-0">
                  <div class="truncate font-medium text-(--text-primary) opacity-75">
                    {{ file.name }}
                  </div>
                </div>
              </div>
            </template>
            <template #cell-originalLocation="{ row: file }">
              <!-- 原位置 (Clickable in future, now plain text) -->
              <span
                class="inline-block max-w-[20rem] truncate whitespace-nowrap text-xs text-(--text-secondary) opacity-75"
                :title="file.originalPath || '-'"
              >
                {{ file.originalPath || '-' }}
              </span>
            </template>
            <template #cell-size="{ row: file }">
              <span class="text-(--text-secondary) opacity-75">{{ formatSize(file.size) }}</span>
            </template>
            <template #cell-deletedAt="{ row: file }">
              <span class="text-(--text-secondary) opacity-75">{{
                formatDate(file.deletedAt)
              }}</span>
            </template>
            <template #cell-actions="{ row: file }">
              <div
                class="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <AppButton
                  variant="ghost"
                  size="sm"
                  class="!h-8 !w-8 !px-0 text-success hover:bg-success/10 hover:text-success"
                  :title="t('trash.restore')"
                  @click.stop="handleRestore(file)"
                >
                  <template #icon-left>
                    <AppIcon name="arrow-path" class="size-4" />
                  </template>
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="sm"
                  class="!h-8 !w-8 !px-0 text-danger hover:bg-danger/10 hover:text-danger"
                  :title="t('trash.deleteForever')"
                  @click.stop="requestDelete(file)"
                >
                  <template #icon-left>
                    <AppIcon name="trash" class="size-4" />
                  </template>
                </AppButton>
              </div>
            </template>
          </AppTable>
        </div>
      </div>

      <!-- 确认清空弹窗 -->
      <ConfirmDialog
        v-model="showEmptyConfirm"
        type="danger"
        :title="t('trash.confirmEmptyTitle')"
        :message="t('trash.confirmEmpty')"
        :confirm-text="t('trash.emptyTrash')"
        :loading="loading"
        @confirm="handleEmptyTrash"
      />
      <ConfirmDialog
        v-model="showDeleteConfirm"
        type="danger"
        :title="t('trash.deleteForever')"
        :message="deleteConfirmMessage"
        :confirm-text="t('trash.deleteForever')"
        :loading="loading"
        @confirm="handleDeleteConfirmed"
      />
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useFileManager } from '@/composables/useFileManager';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppTable from '@/components/ui/AppTable.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'change']);

// Fix: Use computed for v-model to avoid mutating prop
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const { t } = useI18n();
const {
  files,
  loading,
  loadTrashData,
  restoreTrashItems,
  deleteTrashItems,
  emptyTrash,
  isImage,
  formatSize,
  formatDate,
} = useFileManager();

const selectedIds = ref([]);
const showEmptyConfirm = ref(false);
const showDeleteConfirm = ref(false);
const pendingDeleteIds = ref([]);

const isAllSelected = computed(() => {
  return files.value.length > 0 && selectedIds.value.length === files.value.length;
});

const deleteConfirmMessage = computed(() => {
  if (pendingDeleteIds.value.length > 1) {
    return t('trash.confirmDelete');
  }

  const [pendingId] = pendingDeleteIds.value;
  const target = files.value.find((file) => file.id === pendingId);
  return target?.name ? `${t('trash.confirmDelete')} (${target.name})` : t('trash.confirmDelete');
});

// Watch visibility to load data
watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      loadTrashData();
      selectedIds.value = [];
    }
  }
);

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = files.value.map((f) => f.id);
  }
};

const toggleSelection = (row) => {
  const index = selectedIds.value.indexOf(row.id);
  if (index > -1) {
    selectedIds.value.splice(index, 1);
  } else {
    selectedIds.value.push(row.id);
  }
};

const getRowClass = (row) => {
  return selectedIds.value.includes(row.id) ? 'bg-(--color-primary-bg)/50' : '';
};

const columns = computed(() => [
  { key: 'selection', label: '', width: '48px' },
  { key: 'name', label: t('fileManager.table.name'), width: '280px', minWidth: '280px' },
  {
    key: 'originalLocation',
    label: t('trash.originalLocation'),
    kind: 'path',
    width: '360px',
    maxWidth: '360px',
  },
  {
    key: 'size',
    label: t('fileManager.table.size'),
    kind: 'numeric',
    width: '120px',
    maxWidth: '120px',
  },
  {
    key: 'deletedAt',
    label: t('trash.deletedAt'),
    kind: 'datetime',
    width: '160px',
    maxWidth: '160px',
  },
  { key: 'actions', label: t('fileManager.table.actions'), align: 'right', width: '120px' },
]);

const handleRestore = async (file) => {
  if (await restoreTrashItems([file.id])) {
    files.value = files.value.filter((f) => f.id !== file.id);
    emit('change');
  }
};

const requestDelete = (file) => {
  pendingDeleteIds.value = [file.id];
  showDeleteConfirm.value = true;
};

const handleRestoreSelected = async () => {
  if (await restoreTrashItems(selectedIds.value)) {
    files.value = files.value.filter((f) => !selectedIds.value.includes(f.id));
    selectedIds.value = [];
    emit('change');
  }
};

const requestDeleteSelected = () => {
  pendingDeleteIds.value = [...selectedIds.value];
  showDeleteConfirm.value = pendingDeleteIds.value.length > 0;
};

const handleDeleteConfirmed = async () => {
  if (pendingDeleteIds.value.length === 0) {
    showDeleteConfirm.value = false;
    return;
  }

  if (await deleteTrashItems(pendingDeleteIds.value)) {
    files.value = files.value.filter((f) => !pendingDeleteIds.value.includes(f.id));
    selectedIds.value = selectedIds.value.filter((id) => !pendingDeleteIds.value.includes(id));
    showDeleteConfirm.value = false;
    pendingDeleteIds.value = [];
    emit('change');
  }
};

const handleEmptyTrash = async () => {
  if (await emptyTrash()) {
    showEmptyConfirm.value = false;
    await loadTrashData();
    emit('change');
  }
};
</script>

<style scoped>
/* 列表项交错进入动画 */
tr {
  animation: slideIn 0.3s ease-out forwards;
  opacity: 0;
  transform: translateY(10px);
}

@keyframes slideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
.list-move {
  transition: transform 0.5s ease;
}
</style>
