<template>
  <div
    class="relative flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]"
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
      <div class="scrollbar-thin flex max-w-2xl items-center gap-2 overflow-x-auto" :class="{ 'hidden lg:flex': selectedIds.size > 0 }">
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
        <!-- 批量操作 (当有选中项时显示) -->
        <template v-if="selectedIds.size > 0">
          <div class="flex flex-1 items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700 animate-in fade-in slide-in-from-right-4 duration-300">
            <span class="whitespace-nowrap font-medium">{{ t('fileManager.selected', { count: selectedIds.size }) }}</span>
            <div class="mx-1 h-4 w-px bg-blue-200"></div>
            <div class="flex items-center gap-1 ml-auto sm:ml-0">
                <button class="hover:text-blue-900 hover:underline px-1" @click="handleBatchMove">
                {{ t('fileManager.actions.move') }}
                </button>
                <button class="text-red-600 hover:text-red-800 hover:underline px-1" @click="handleBatchDelete">
                {{ t('fileManager.actions.delete') }}
                </button>
                <button class="text-gray-500 hover:text-gray-700 px-1" @click="selectedIds.clear()">
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
          </div>
          <div class="hidden lg:block h-6 w-px bg-[var(--border-color)]"></div>
        </template>

        <!-- 常规按钮 -->
        <Tooltip v-if="currentFolder" :content="t('fileManager.shareFolder')">
          <button
            class="text-secondary flex size-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] transition-all hover:text-primary hover:bg-[var(--bg-hover)]"
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
            class="text-secondary flex size-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] transition-all hover:text-primary hover:bg-[var(--bg-hover)]"
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

        <!-- View Toggle -->
         <div class="flex items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1 hidden lg:flex">
             <button
               class="rounded-lg p-1.5 transition-all"
               :class="viewMode === 'list' ? 'bg-[var(--bg-hover)] text-primary shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'"
               :title="t('fileManager.viewMode.list')"
               @click="viewMode = 'list'"
             >
               <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
             </button>
             <button
               class="rounded-lg p-1.5 transition-all"
               :class="viewMode === 'grid' ? 'bg-[var(--bg-hover)] text-primary shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'"
               :title="t('fileManager.viewMode.grid')"
               @click="viewMode = 'grid'"
             >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
             </button>
         </div>

      </div>
    </div>

    <!-- 当前文件夹信息 & 全选 (列表模式下可选) -->
    <div
      v-if="currentFolder"
      class="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-muted)] px-6 py-3 text-sm"
    >
      <div class="text-secondary flex items-center gap-4">
        <span>{{ t('fileManager.totalFiles', { count: displayedFiles.length }) }}</span>
        <span>{{ t('fileManager.totalFolders', { count: displayedSubfolders.length }) }}</span>
      </div>
       <div class="hidden lg:block" v-if="displayedFiles.length > 0 && viewMode === 'list'">
         <label class="flex items-center gap-2 cursor-pointer text-secondary hover:text-primary">
            <input type="checkbox" class="checkbox checkbox-sm checkbox-primary rounded" :checked="selectedIds.size === displayedFiles.length && displayedFiles.length > 0" @change="selectAll">
            <span>{{ t('fileManager.manage.selectAll') }}</span>
         </label>
       </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex min-h-[200px] flex-1 items-center justify-center">
      <div class="border-primary size-8 animate-spin rounded-full border-b-2"></div>
    </div>

    <!-- 内容区域 -->
    <div v-else class="flex flex-1 flex-col" @contextmenu.prevent>
      <!-- 文件夹列表 -->
      <div v-if="displayedSubfolders.length > 0" class="p-6 pb-0">
        <FolderGrid
          :folders="displayedSubfolders"
          :selected-ids="selectedIds"
          @navigate="navigateTo"
          @delete="handleDeleteFolder"
          @context-menu="openContextMenu($event, $event, 'folder')"
        />
      </div>

      <!-- 分隔线 -->
      <div
        v-if="displayedSubfolders.length > 0 && displayedFiles.length > 0"
        class="m-6 h-px bg-[var(--border-color)]"
      ></div>

      <!-- 文件列表 -->
      <div v-if="displayedFiles.length > 0" class="flex-1 p-4 pt-0 lg:p-6" @click="selectedIds.clear()">
        <h3
          v-if="displayedSubfolders.length > 0"
          class="text-secondary my-4 text-sm font-semibold lg:mt-6"
        >
          {{ t('fileManager.filesHeader') }}
        </h3>

        <!-- 桌面视图 (支持切换) -->
        <div class="hidden lg:block">
           <template v-if="viewMode === 'list'">
               <FileTable
                :files="displayedFiles"
                :selected-ids="selectedIds"
                @share="handleShareFile"
                @move="handleMoveFile"
                @delete="handleDeleteFile"
                @context-menu="openContextMenu($event, $event, 'file')"
                @toggle-select="toggleSelect"
              />
           </template>
           <template v-else>
               <!-- Grid View for Files (Reusing Cards or creating new Grid?) - Let's use FileCards tailored for desktop grid if possible, or just Cards -->
                <div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    <!-- Simple Grid Items similar to Folders but for Files -->
                    <div
                      v-for="file in displayedFiles"
                      :key="file.id"
                      class="group relative cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md"
                      :class="[
                        selectedIds.has(file.id)
                          ? 'border-primary bg-blue-50/50 dark:bg-blue-900/30 ring-1 ring-primary'
                          : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--border-hover)]'
                      ]"
                       @click.stop="toggleSelect(file)"
                       @dblclick="window.open(file.url, '_blank')"
                       @contextmenu.prevent.stop="openContextMenu($event, file, 'file')"
                    >
                         <!-- File Grid Logic (Thumbnail + Name) -->
                        <div class="flex flex-col items-center">
                            <img
                              v-if="isImage(file)"
                              :src="file.url"
                              class="mb-2 size-16 rounded object-cover shadow-sm bg-gray-50"
                              loading="lazy"
                            />
                             <div
                              v-else
                              class="text-secondary mb-2 flex size-16 items-center justify-center rounded bg-gray-100 text-xs font-bold uppercase"
                            >
                              {{ getFileExtension(file.name) }}
                            </div>
                            
                            <div class="text-primary w-full truncate px-2 text-center text-sm font-medium" :title="file.name">
                                {{ file.name }}
                            </div>
                            <div class="text-secondary mt-1 text-xs">{{ formatSize(file.size) }}</div>
                        </div>
                    </div>
                </div>
           </template>
        </div>

        <!-- 移动端卡片视图 (<lg) -->
        <div class="lg:hidden">
          <FileCards :files="displayedFiles" @share="handleShareFile" @delete="handleDeleteFile" @context-menu="openContextMenu($event, $event, 'file')" />
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
            @keydown.stop
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
    
    <!-- Rename Modal -->
    <Modal v-model="showRenameModal" :title="t('fileManager.contextMenu.rename')" size="sm">
      <form @submit.prevent="handleRename">
        <div class="mb-4">
          <label class="text-primary mb-1 block text-sm font-medium">{{ t('fileManager.table.name') }}</label>
          <input
             v-model="renameName"
             type="text"
             required
             class="input w-full"
             autofocus
             @keydown.stop
          />
        </div>
      </form>
       <template #footer>
        <button type="button" class="btn btn-secondary" @click="showRenameModal = false">
          {{ t('common.cancel') }}
        </button>
        <button class="btn btn-primary" @click="handleRename">
          {{ t('common.save') }}
        </button>
      </template>
    </Modal>

    <!-- Move Item Modal -->
    <MoveItemModal v-model="showMoveModal" :items-to-move="itemsToMove" @moved="handleMoved" />

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
    
    <!-- Context Menu -->
    <ContextMenu
       v-model="contextMenuData.show"
       :x="contextMenuData.x"
       :y="contextMenuData.y"
       :items="contextMenuData.items"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, onUnmounted, onActivated, watch, computed } from 'vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import Modal from '@/components/ui/Modal.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ContextMenu from '@/components/ui/ContextMenu.vue';
import FolderGrid from './FolderGrid.vue';
import FileTable from './FileTable.vue';
import FileCards from './FileCards.vue';
import { useFileManager } from '@/composables/useFileManager';
import { useI18n } from '@/composables/useI18n';
import { useSearch } from '@/composables/useSearch';
import MoveItemModal from '@/components/MoveItemModal.vue';
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
  renameFile,
  renameFolder,
  moveFolder,
  batchDeleteFiles,
  batchMoveFiles,
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

// UI State
const viewMode = ref('list'); // 'list' | 'grid'
const showModal = ref(false);
const showMoveModal = ref(false);
const showShareModal = ref(false);
const showShareFileModal = ref(false);
const showRenameModal = ref(false);

// Items to Move: Array of { id, type }
const itemsToMove = ref([]);
const folderName = ref('');
const renameName = ref('');
const renameTarget = ref(null); // { id, type, name }

const isDragging = ref(false);
const dragCounter = ref(0);
const currentShareFile = ref(null);

// Selection State
const selectedIds = ref(new Set());

// Context Menu State
const contextMenuData = ref({
  show: false,
  x: 0,
  y: 0,
  items: [],
});

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
  if (selectedIds.value.size > 0) {
    selectedIds.value.clear();
  }
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

const handleRename = async () => {
  if (!renameTarget.value) return;
  const { id, type } = renameTarget.value;
  let success = false;
  if (type === 'file') {
    success = await renameFile(id, renameName.value);
  } else {
    success = await renameFolder(id, renameName.value);
  }
  if (success) {
    showRenameModal.value = false;
    renameTarget.value = null;
  }
};

const openRenameModal = (target) => { // target: { id, type, name }
  renameTarget.value = target;
  renameName.value = target.name;
  showRenameModal.value = true;
};

// Batch Actions
const toggleSelect = (item) => {
  if (selectedIds.value.has(item.id)) {
    selectedIds.value.delete(item.id);
  } else {
    selectedIds.value.add(item.id);
  }
};

const selectAll = () => {
  if (selectedIds.value.size === displayedFiles.value.length) {
    selectedIds.value.clear();
  } else {
    displayedFiles.value.forEach(f => selectedIds.value.add(f.id));
  }
};

const handleBatchDelete = () => {
  if (selectedIds.value.size === 0) return;
  
  confirmData.value = {
    show: true,
    title: t('common.delete'),
    message: t('fileManager.deleteConfirm', { count: selectedIds.value.size }),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        const ids = Array.from(selectedIds.value);
        // Currently only batch delete files supported by API
        // For mixed selection implementation needs to be careful
        // Assuming we select only files for now in the file table
        await batchDeleteFiles(ids);
        selectedIds.value.clear();
        confirmData.value.show = false;
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

const handleBatchMove = () => {
  if (selectedIds.value.size === 0) return;
  itemsToMove.value = Array.from(selectedIds.value).map(id => ({ id, type: 'file' }));
  showMoveModal.value = true;
};


// Single Item Actions
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
        if (selectedIds.value.has(file.id)) selectedIds.value.delete(file.id);
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
    selectedIds.value.clear();
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
  itemsToMove.value = [{ id: file.id, type: 'file' }];
  showMoveModal.value = true;
};

const handleMoveFolder = (folder) => { // New: Move Folder
  itemsToMove.value = [{ id: folder.id, type: 'folder' }];
  showMoveModal.value = true;
};

const handleMoved = () => {
  loadFolderData(currentFolder.value?.id);
  selectedIds.value.clear();
};

// Context Menu Handler
const openContextMenu = (e, item, type) => { // type: 'file' | 'folder'
  // If item not in selection, clear selection and select it
  // (Standard file manager behavior)
  if (!selectedIds.value.has(item.id)) {
    // Only clear if not holding Ctrl/Shift (simplified)
    // Here we prefer single selection behavior for context menu if obscure
    // But let's just add it to selection if not present
  }
  
  const menuItems = [
    { label: t('fileManager.contextMenu.open'), icon: null, action: () => type === 'folder' ? navigateTo(item.id) : window.open(item.url, '_blank') },
    { label: t('fileManager.contextMenu.rename'), icon: null, action: () => openRenameModal({ id: item.id, type, name: item.name }) },
    { label: t('fileManager.contextMenu.move'), icon: null, action: () => type === 'folder' ? handleMoveFolder(item) : handleMoveFile(item) },
  ];

  if (type === 'file') {
    menuItems.push({ label: t('fileManager.contextMenu.share'), icon: null, action: () => handleShareFile(item) });
    menuItems.push({ label: t('fileManager.contextMenu.download'), icon: null, action: () => window.open(item.url, '_blank') }); // Simply open for now
  } else {
    // Share folder logic
     // Could add share folder action if not root
  }
  
  menuItems.push({ type: 'separator' });
  menuItems.push({ 
    label: t('fileManager.contextMenu.delete'), 
    icon: null, 
    danger: true, 
    action: () => type === 'folder' ? handleDeleteFolder(item) : handleDeleteFile(item) 
  });

  contextMenuData.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    items: menuItems,
  };
};

const preventDefaultHandler = (e) => e.preventDefault();
const closeContextMenu = () => contextMenuData.value.show = false;

onMounted(() => {
  loadFolderData();
  window.addEventListener('dragover', preventDefaultHandler);
  window.addEventListener('drop', preventDefaultHandler);
  window.addEventListener('click', closeContextMenu);
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
  window.removeEventListener('click', closeContextMenu);
});
</script>
