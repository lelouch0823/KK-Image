<template>
  <Modal
    v-model="visible"
    :title="t('trash.title')"
    size="5xl"
    :close-on-backdrop="true"
    body-class="p-0 flex flex-col h-[70vh]"
  >
    <div class="flex h-full flex-col bg-[var(--bg-default)]">
      <!-- 头部工具栏 -->
      <div
        class="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-color)] px-6"
      >
        <div class="flex items-center gap-3">
          <div v-if="files.length > 0" class="text-sm text-[var(--text-muted)]">
            {{ t('fileManager.totalFiles', { count: files.length }) }}
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- 批量操作 -->
          <transition name="fade">
            <div v-if="selectedIds.length > 0" class="flex items-center gap-2">
              <span class="mr-2 text-sm text-[var(--text-muted)]">
                {{ t('fileManager.selected', { count: selectedIds.length }) }}
              </span>
              <button
                class="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary-bg)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
                @click="handleRestoreSelected"
                :disabled="loading"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  ></path>
                </svg>
                {{ t('trash.restore') }}
              </button>
              <button
                class="flex items-center gap-1.5 rounded-lg bg-[var(--color-danger-bg)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] transition-colors hover:bg-red-100"
                @click="handleDeleteSelected"
                :disabled="loading"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
                {{ t('trash.deleteForever') }}
              </button>
            </div>
          </transition>

          <!-- 清空回收站 -->
          <button
            v-if="files.length > 0"
            class="group relative flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] transition-all hover:bg-[var(--color-danger)]/10 hover:shadow-sm disabled:opacity-50"
            @click="showEmptyConfirm = true"
            :disabled="loading || selectedIds.length > 0"
          >
            <svg
              class="size-4 transition-transform duration-300 group-hover:rotate-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              ></path>
            </svg>
            {{ t('trash.emptyTrash') }}
          </button>
        </div>
      </div>

      <!-- 主要内容区域 -->
      <div class="flex-1 overflow-hidden p-6">
        <!-- Loading 状态 -->
        <div v-if="loading" class="flex h-full items-center justify-center">
          <div
            class="size-10 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent"
          ></div>
        </div>

        <!-- 空状态 -->
        <div
          v-else-if="files.length === 0"
          class="flex h-full flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500"
        >
          <div class="relative mb-6">
            <div
              class="absolute -inset-4 rounded-full bg-gradient-to-tr from-green-100 to-blue-50 opacity-50 blur-xl"
            ></div>
            <svg
              class="relative size-32 text-[var(--text-muted)]/20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <h3 class="mb-2 text-xl font-medium text-[var(--text-primary)]">
            {{ t('trash.empty') }}
          </h3>
          <p class="text-[var(--text-secondary)]">{{ t('trash.emptyDesc') }}</p>
        </div>

        <!-- 文件列表 -->
        <div v-else class="h-full overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <table class="w-full text-left text-sm">
            <thead class="bg-[var(--bg-muted)] sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th class="w-12 px-4 py-3">
                  <AppCheckbox
                    :checked="isAllSelected"
                    @change="toggleSelectAll"
                  />
                </th>
                <th class="px-4 py-3 font-medium text-[var(--text-secondary)]">
                  {{ t('fileManager.table.name') }}
                </th>
                <th class="px-4 py-3 font-medium text-[var(--text-secondary)]">
                  {{ t('trash.originalLocation') }}
                </th>
                <th class="px-4 py-3 font-medium text-[var(--text-secondary)]">
                  {{ t('fileManager.table.size') }}
                </th>
                <th class="px-4 py-3 font-medium text-[var(--text-secondary)]">
                  {{ t('trash.deletedAt') }}
                </th>
                <th class="w-32 px-4 py-3 font-medium text-[var(--text-secondary)] text-right">
                  {{ t('fileManager.table.actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-color)] relative">
              <transition-group name="list">
              <tr
                v-for="(file, index) in files"
                :key="file.id"
                class="group transition-colors hover:bg-[var(--bg-hover)]"
                :class="{ 'bg-[var(--color-primary-bg)]/50': selectedIds.includes(file.id) }"
                :style="{ animationDelay: `${index * 50}ms` }"
              >
                <td class="px-4 py-3">
                  <AppCheckbox
                    :value="file.id"
                    v-model="selectedIds"
                  />
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <!-- 图标 (Grayscale filter) -->
                    <div
                      class="flex size-8 shrink-0 items-center justify-center rounded bg-[var(--bg-muted)] text-[var(--text-muted)] grayscale opacity-80"
                    >
                      <AppImage
                        v-if="isImage(file.name) && file.thumbnail"
                        :src="file.thumbnail"
                        :blurhash="file.blurhash"
                        class="size-full"
                        fit="cover"
                        rounded="sm"
                      />
                      <svg
                        v-else-if="file.type === 'folder'"
                        class="size-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                        />
                      </svg>
                      <svg
                        v-else
                        class="size-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        ></path>
                      </svg>
                    </div>
                    <div class="min-w-0">
                      <div class="truncate font-medium text-[var(--text-primary)] opacity-75">
                        {{ file.name }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-[var(--text-secondary)]">
                  <!-- 原位置 (Clickable in future, now plain text) -->
                  <span class="text-xs opacity-75">{{ file.originalPath || '-' }}</span>
                </td>
                <td class="px-4 py-3 text-[var(--text-secondary)] opacity-75">
                  {{ formatSize(file.size) }}
                </td>
                <td class="px-4 py-3 text-[var(--text-secondary)] opacity-75">
                  {{ formatDate(file.deletedAt) }}
                </td>
                <td class="px-4 py-3 text-right">
                  <div
                    class="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <button
                      class="rounded p-1 text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
                      :title="t('trash.restore')"
                      @click="handleRestore(file)"
                    >
                      <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        ></path>
                      </svg>
                    </button>
                    <button
                      class="rounded p-1 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                      :title="t('trash.deleteForever')"
                      @click="handleDelete(file)"
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
              </transition-group>
            </tbody>
          </table>
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
import { ref, computed, watch, onMounted } from 'vue';
import { useFileManager } from '@/composables/useFileManager';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import AppImage from '@/components/ui/AppImage.vue';

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
