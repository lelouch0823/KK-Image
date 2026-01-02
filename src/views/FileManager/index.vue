<template>
  <div
    class="relative flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-white"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <!-- 拖拽上传覆盖层 -->
    <transition name="fade">
      <div
        v-if="isDragging"
        class="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-info)] bg-[var(--color-info-bg)]/90 backdrop-blur-sm"
      >
        <div class="mb-4 animate-bounce rounded-full bg-white p-6 shadow-lg">
          <svg
            class="size-12 text-[var(--color-info)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            ></path>
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-[var(--color-info-text)]">
          {{ t('fileManager.dragDropTitle') }}
        </h3>
        <p class="mt-2 text-[var(--color-info)]">{{ t('fileManager.dragDropDesc') }}</p>
      </div>
    </transition>

    <!-- 工具栏 -->
    <div class="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
      <!-- 面包屑 -->
      <div class="scrollbar-thin flex max-w-2xl items-center gap-2 overflow-x-auto">
        <button
          class="hover:text-primary flex items-center gap-1 text-sm font-medium whitespace-nowrap transition-colors"
          :class="!currentFolder ? 'text-primary' : 'text-secondary'"
          @click="navigateTo(null)"
        >
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            ></path>
          </svg>
          {{ t('fileManager.root') }}
        </button>
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id">
          <span class="text-secondary text-sm">/</span>
          <button
            class="hover:text-primary text-sm font-medium whitespace-nowrap transition-colors"
            :class="index === breadcrumbs.length - 1 ? 'text-primary' : 'text-secondary'"
            @click="navigateTo(crumb.id)"
          >
            {{ crumb.name }}
          </button>
        </template>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center gap-3">
        <Tooltip v-if="currentFolder" :content="t('fileManager.shareFolder')">
          <button
            class="text-secondary flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white transition-all hover:text-primary hover:bg-gray-50"
            @click="handleShareFolder"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              ></path>
            </svg>
          </button>
        </Tooltip>

        <input ref="fileInput" type="file" multiple class="hidden" @change="handleFileSelect" />

        <Tooltip :content="t('fileManager.upload')">
          <button
            class="bg-primary flex size-10 items-center justify-center rounded-xl text-white shadow-lg shadow-gray-900/10 transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-gray-900/20 active:translate-y-0"
            @click="$refs.fileInput.click()"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              ></path>
            </svg>
          </button>
        </Tooltip>

        <Tooltip :content="t('fileManager.newFolder')">
          <button
            class="text-secondary flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white transition-all hover:text-primary hover:bg-gray-50"
            @click="openCreateFolderModal"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              ></path>
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>

    <!-- 当前文件夹信息 -->
    <div
      v-if="currentFolder"
      class="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-muted)] px-6 py-3 text-sm"
    >
      <div class="text-secondary flex items-center gap-4">
        <span>{{ t('fileManager.totalFiles', { count: displayedFiles.length }) }}</span>
        <span>{{ t('fileManager.totalFolders', { count: displayedSubfolders.length }) }}</span>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex min-h-[200px] flex-1 items-center justify-center">
      <div class="border-primary size-8 animate-spin rounded-full border-b-2"></div>
    </div>

    <!-- 内容区域 -->
    <div v-else class="flex flex-1 flex-col">
      <!-- 文件夹列表 -->
      <div v-if="displayedSubfolders.length > 0" class="p-6 pb-0">
        <FolderGrid
          :folders="displayedSubfolders"
          @navigate="navigateTo"
          @delete="handleDeleteFolder"
        />
      </div>

      <!-- 分隔线 -->
      <div
        v-if="displayedSubfolders.length > 0 && displayedFiles.length > 0"
        class="m-6 h-px bg-[var(--border-color)]"
      ></div>

      <!-- 文件列表 -->
      <div v-if="displayedFiles.length > 0" class="flex-1 p-4 pt-0 lg:p-6">
        <h3
          v-if="displayedSubfolders.length > 0"
          class="text-secondary my-4 text-sm font-semibold lg:mt-6"
        >
          {{ t('fileManager.filesHeader') }}
        </h3>

        <!-- 桌面表格视图 (lg+) -->
        <div class="hidden overflow-x-auto lg:block">
          <FileTable
            :files="displayedFiles"
            @share="handleShareFile"
            @move="handleMoveFile"
            @delete="handleDeleteFile"
          />
        </div>

        <!-- 移动端卡片视图 (<lg) -->
        <div class="lg:hidden">
          <FileCards :files="displayedFiles" @share="handleShareFile" @delete="handleDeleteFile" />
        </div>
      </div>

      <!-- 空状态 -->
      <EmptyState
        v-if="!loading && displayedSubfolders.length === 0 && displayedFiles.length === 0"
        icon="folder"
        :title="t('fileManager.emptyFolder')"
        :description="t('fileManager.emptyDesc')"
      />
    </div>

    <!-- 创建文件夹 Modal -->
    <Modal v-model="showModal" :title="t('fileManager.newFolder')" size="sm">
      <form @submit.prevent="handleCreateFolder">
        <div class="mb-4">
          <label class="text-primary mb-1 block text-sm font-medium">{{
            t('fileManager.table.name')
          }}</label>
          <input
            v-model="folderName"
            type="text"
            required
            class="input w-full"
            :placeholder="t('fileManager.folderNamePlaceholder')"
            autofocus
          />
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="showModal = false">
          {{ t('common.cancel') }}
        </button>
        <button class="btn btn-primary" @click="handleCreateFolder">
          {{ t('common.confirm') }}
        </button>
      </template>
    </Modal>

    <!-- Move File Modal -->
    <MoveFileModal v-model="showMoveModal" :files-to-move="filesToMove" @moved="handleMoved" />

    <!-- Share Folder Modal -->
    <ShareFolderModal
      v-model="showShareModal"
      :folder="currentFolder"
      @updated="handleShareUpdated"
    />

    <!-- Share File Modal -->
    <ShareFileModal v-model="showShareFileModal" :file="currentShareFile" />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="confirmData.onConfirm"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, onUnmounted, onActivated, watch, computed } from 'vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import Modal from '@/components/ui/Modal.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import FolderGrid from './FolderGrid.vue';
import FileTable from './FileTable.vue';
import FileCards from './FileCards.vue';
import { useFileManager } from '@/composables/useFileManager';
import { useI18n } from '@/composables/useI18n';
import { useSearch } from '@/composables/useSearch';
import MoveFileModal from '@/components/MoveFileModal.vue';
import ShareFolderModal from '@/components/ShareFolderModal.vue';
import ShareFileModal from '@/components/ShareFileModal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import { useToast } from '@/composables/useToast';
import { useUploadQueue } from '@/composables/useUploadQueue';

const { addToast } = useToast();
const { addFiles, registerFolderRefresh, unregisterFolderRefresh } = useUploadQueue();
const { t } = useI18n();

const {
  loading,
  currentFolder,
  subfolders,
  files,
  breadcrumbs,
  loadFolderData,
  createFolder,
  deleteFolder,
  deleteFile,
} = useFileManager();

const { searchQuery } = useSearch();

const displayedSubfolders = computed(() => {
  if (!searchQuery.value) return subfolders.value;
  const query = searchQuery.value.toLowerCase();
  return subfolders.value.filter((f) => f.name.toLowerCase().includes(query));
});

const displayedFiles = computed(() => {
  if (!searchQuery.value) return files.value;
  const query = searchQuery.value.toLowerCase();
  return files.value.filter(
    (f) =>
      f.name.toLowerCase().includes(query) ||
      (f.originalName && f.originalName.toLowerCase().includes(query))
  );
});

const showModal = ref(false);
const showMoveModal = ref(false);
const showShareModal = ref(false);
const showShareFileModal = ref(false);
const filesToMove = ref([]);
const folderName = ref('');
const isDragging = ref(false);
const dragCounter = ref(0);
const currentShareFile = ref(null);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

const navigateTo = (id) => {
  loadFolderData(id);
};

const openCreateFolderModal = () => {
  folderName.value = '';
  showModal.value = true;
};

const handleCreateFolder = async () => {
  const success = await createFolder({ name: folderName.value });
  if (success) showModal.value = false;
};

const handleDeleteFile = (file) => {
  confirmData.value = {
    show: true,
    title: t('common.delete'),
    message: t('fileManager.deleteFileConfirm', { name: file.name }),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        await deleteFile(file.id);
        confirmData.value.show = false;
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

const handleDeleteFolder = (folder) => {
  confirmData.value = {
    show: true,
    title: t('common.delete'),
    message: t('fileManager.deleteFolderConfirm', { name: folder.name }),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        await deleteFolder(folder.id);
        confirmData.value.show = false;
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

// Folder-aware upload refresh
watch(
  currentFolder,
  (newFolder, oldFolder) => {
    if (oldFolder?.id) {
      unregisterFolderRefresh(oldFolder.id);
    }
    if (newFolder?.id) {
      registerFolderRefresh(newFolder.id, () => {
        loadFolderData(newFolder.id, { silent: true });
      });
    }
  },
  { immediate: true }
);

const handleFileSelect = (e) => {
  const selectedFiles = Array.from(e.target.files);
  if (selectedFiles.length) {
    if (!currentFolder.value) {
      addToast({ message: t('fileManager.selectFolderFirst'), type: 'warning' });
      return;
    }
    addFiles(selectedFiles, currentFolder.value.id);
    e.target.value = '';
  }
};

const onDragEnter = (e) => {
  e.preventDefault();
  dragCounter.value++;
  if (currentFolder.value) {
    isDragging.value = true;
  }
};

const onDragLeave = (e) => {
  e.preventDefault();
  dragCounter.value--;
  if (dragCounter.value === 0) {
    isDragging.value = false;
  }
};

const onDragOver = (e) => {
  e.preventDefault();
};

const onDrop = (e) => {
  e.preventDefault();
  isDragging.value = false;
  dragCounter.value = 0;

  if (!currentFolder.value) return;

  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    addFiles(Array.from(e.dataTransfer.files), currentFolder.value.id);
  }
};

const handleShareFile = (file) => {
  currentShareFile.value = file;
  showShareFileModal.value = true;
};

const handleShareFolder = () => {
  showShareModal.value = true;
};

const handleShareUpdated = () => {
  loadFolderData(currentFolder.value?.id);
};

const handleMoveFile = (file) => {
  filesToMove.value = [file.id];
  showMoveModal.value = true;
};

const handleMoved = () => {
  loadFolderData(currentFolder.value?.id);
};

const preventDefaultHandler = (e) => e.preventDefault();

onMounted(() => {
  loadFolderData();
  window.addEventListener('dragover', preventDefaultHandler);
  window.addEventListener('drop', preventDefaultHandler);
});

onActivated(() => {
  loadFolderData(currentFolder.value?.id);
});

onUnmounted(() => {
  if (currentFolder.value?.id) {
    unregisterFolderRefresh(currentFolder.value.id);
  }
  window.removeEventListener('dragover', preventDefaultHandler);
  window.removeEventListener('drop', preventDefaultHandler);
});
</script>
