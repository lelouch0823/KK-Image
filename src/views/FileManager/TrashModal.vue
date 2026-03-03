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
              <button
                class="flex items-center gap-1.5 rounded-lg bg-(--color-primary-bg) px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-(--color-primary-hover)"
                :disabled="loading"
                @click="handleRestoreSelected"
              >
                <AppIcon name="arrow-path" class="size-4" />
                {{ t('trash.restore') }}
              </button>
              <button
                class="flex items-center gap-1.5 rounded-lg bg-(--color-danger-bg) px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-red-100"
                :disabled="loading"
                @click="handleDeleteSelected"
              >
                <AppIcon name="trash" class="size-4" />
                {{ t('trash.deleteForever') }}
              </button>
            </div>
          </transition>

          <!-- 清空回收站 -->
          <button
            v-if="files.length > 0"
            class="group relative flex items-center gap-2 rounded-lg border border-danger/30 bg-(--bg-card) px-4 py-2 text-sm font-medium text-danger transition-all hover:bg-danger/10 hover:shadow-sm disabled:opacity-50"
            :disabled="loading || selectedIds.length > 0"
            @click="showEmptyConfirm = true"
          >
            <AppIcon
              class="size-4 transition-transform duration-300 group-hover:rotate-12"
              name="trash"
            />
            {{ t('trash.emptyTrash') }}
          </button>
        </div>
      </div>

      <!-- 主要内容区域 -->
      <div class="flex-1 overflow-hidden p-6">
        <!-- Loading 状态 -->
        <div v-if="loading" class="flex h-full items-center justify-center">
          <div
            class="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
          ></div>
        </div>

        <!-- 空状态 -->
        <div
          v-else-if="files.length === 0"
          class="animate-in fade-in zoom-in flex h-full flex-col items-center justify-center text-center duration-500"
        >
          <div class="relative mb-6">
            <div
              class="absolute -inset-4 rounded-full bg-gradient-to-tr from-green-100 to-blue-50 opacity-50 blur-xl"
            ></div>
            <AppIcon
              class="relative size-32 text-(--text-muted)/20"
              name="check-circle"
            />
          </div>
          <h3 class="mb-2 text-xl font-medium text-(--text-primary)">
            {{ t('trash.empty') }}
          </h3>
          <p class="text-(--text-secondary)">{{ t('trash.emptyDesc') }}</p>
        </div>

        <!-- 文件列表 -->
        <div v-else class="h-full overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card) shadow-sm">
          <AppTable
            :columns="columns"
            :data="files"
            :row-class="getRowClass"
            @row-click="toggleSelection"
          >
            <template #header-selection>
              <AppCheckbox
                :checked="isAllSelected"
                @change="toggleSelectAll"
              />
            </template>
            <template #cell-selection="{ row: file }">
              <AppCheckbox
                v-model="selectedIds"
                :value="file.id"
                @click.stop
              />
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
                  <AppIcon
                    v-else-if="file.type === 'folder'"
                    class="size-5"
                    name="folder"
                  />
                  <AppIcon
                    v-else
                    class="size-5"
                    name="document"
                  />
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
              <span class="text-xs text-(--text-secondary) opacity-75">{{ file.originalPath || '-' }}</span>
            </template>
            <template #cell-size="{ row: file }">
              <span class="text-(--text-secondary) opacity-75">{{ formatSize(file.size) }}</span>
            </template>
            <template #cell-deletedAt="{ row: file }">
              <span class="text-(--text-secondary) opacity-75">{{ formatDate(file.deletedAt) }}</span>
            </template>
            <template #cell-actions="{ row: file }">
              <div class="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  class="rounded p-1 text-success hover:bg-success/10"
                  :title="t('trash.restore')"
                  @click.stop="handleRestore(file)"
                >
                  <AppIcon name="arrow-path" class="size-4" />
                </button>
                <button
                  class="rounded p-1 text-danger hover:bg-danger/10"
                  :title="t('trash.deleteForever')"
                  @click.stop="handleDelete(file)"
                >
                  <AppIcon name="trash" class="size-4" />
                </button>
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
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useFileManager } from '@/composables/useFileManager';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
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

const isAllSelected = computed(() => {
  return files.value.length > 0 && selectedIds.value.length === files.value.length;
});

// Watch visibility to load data
watch(() => props.modelValue, (visible) => {
  if (visible) {
    loadTrashData();
    selectedIds.value = [];
  }
});

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
  { key: 'name', label: t('fileManager.table.name') },
  { key: 'originalLocation', label: t('trash.originalLocation') },
  { key: 'size', label: t('fileManager.table.size') },
  { key: 'deletedAt', label: t('trash.deletedAt') },
  { key: 'actions', label: t('fileManager.table.actions'), align: 'right', width: '120px' }
]);

const handleRestore = async (file) => {
  if (await restoreTrashItems([file.id])) {
    files.value = files.value.filter(f => f.id !== file.id);
    emit('change');
  }
};

const handleDelete = async (file) => {
  if (confirm(t('trash.confirmDelete'))) {
    if (await deleteTrashItems([file.id])) {
      files.value = files.value.filter(f => f.id !== file.id);
      emit('change');
    }
  }
};

const handleRestoreSelected = async () => {
  if (await restoreTrashItems(selectedIds.value)) {
    files.value = files.value.filter(f => !selectedIds.value.includes(f.id));
    selectedIds.value = [];
    emit('change');
  }
};

const handleDeleteSelected = async () => {
  if (confirm(t('trash.confirmDelete'))) {
    if (await deleteTrashItems(selectedIds.value)) {
      files.value = files.value.filter(f => !selectedIds.value.includes(f.id));
      selectedIds.value = [];
      emit('change');
    }
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
