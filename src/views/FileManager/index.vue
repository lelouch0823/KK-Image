<template>
  <div
    class="relative flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <!-- Drag & Drop Overlay -->
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

    <!-- Toolbar -->
    <FileManagerToolbar
      :breadcrumbs="breadcrumbs"
      :current-folder="currentFolder"
      v-model:view-mode="viewMode"
      :selected-count="selectedIds.size"
      @navigate="navigateTo"
      @upload="handleFileSelect"
      @create-folder="openCreateFolderModal"
      @share-folder="openShareFolderModal"
      @batch-move="handleBatchMove"
      @batch-delete="handleBatchDelete"
      @clear-selection="selectedIds.clear()"
    />

    <!-- Folder Info & Select All -->
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

    <!-- Loading State -->
    <div v-if="loading" class="p-6">
      <div v-if="viewMode === 'list'" class="space-y-4">
        <Skeleton v-for="i in 5" :key="i" type="custom" custom-class="h-12 w-full rounded-lg" />
      </div>
      <div v-else class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <Skeleton v-for="i in 10" :key="i" type="custom" custom-class="aspect-square w-full rounded-xl" />
      </div>
    </div>

    <!-- Content Area -->
    <div v-else class="flex flex-1 flex-col" @contextmenu.prevent="openBackgroundContextMenu($event)">
      <!-- Subfolders -->
      <div v-if="displayedSubfolders.length > 0" class="p-6 pb-0">
        <FolderGrid
          :folders="displayedSubfolders"
          :selected-ids="selectedIds"
          @navigate="navigateTo"
          @delete="handleDeleteFolder"
          @context-menu="(e, folder) => openContextMenu(e, folder, 'folder')"
        />
      </div>

      <!-- Divider -->
      <div
        v-if="displayedSubfolders.length > 0 && displayedFiles.length > 0"
        class="m-6 h-px bg-[var(--border-color)]"
      ></div>

      <!-- Files -->
      <div v-if="displayedFiles.length > 0" class="flex-1 p-4 pt-0 lg:p-6" @click="selectedIds.clear()">
        <h3
          v-if="displayedSubfolders.length > 0"
          class="text-secondary my-4 text-sm font-semibold lg:mt-6"
        >
          {{ t('fileManager.filesHeader') }}
        </h3>

        <!-- Desktop View -->
        <div class="hidden lg:block">
           <template v-if="viewMode === 'list'">
               <FileTable
                :files="displayedFiles"
                :selected-ids="selectedIds"
                @share="handleShareFile"
                @move="handleMoveFile"
                @delete="handleDeleteFile"
                @context-menu="(e, file) => openContextMenu(e, file, 'file')"
                @toggle-select="toggleSelect"
              />
           </template>
           <template v-else>
               <!-- Grid View is basically FileCards but laid out in a grid -->
               <!-- Using a direct grid layout here for simplicity with FileCards logic if reusable, but let's stick to simple implementation like before -->
                <div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    <div
                      v-for="file in displayedFiles"
                      :key="file.id"
                      class="group relative cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-1"
                      :class="[
                        selectedIds.has(file.id)
                          ? 'border-primary bg-blue-50/50 dark:bg-blue-900/30 ring-1 ring-primary'
                          : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--border-hover)]'
                      ]"
                       @click.stop="toggleSelect(file)"
                       @dblclick="window.open(file.url, '_blank')"
                       @contextmenu.prevent.stop="openContextMenu($event, file, 'file')"
                    >
                         <div class="flex flex-col items-center">
                             <img
                               v-if="isImage(file)"
                               :src="file.url"
                               class="mb-2 size-20 rounded object-cover shadow-sm bg-gray-50 dark:bg-gray-800"
                               loading="lazy"
                             />
                              <div
                               v-else
                               class="text-secondary mb-2 flex size-20 items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-sm font-bold uppercase"
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

        <!-- Mobile View -->
        <div class="lg:hidden">
          <FileCards :files="displayedFiles" @share="handleShareFile" @delete="handleDeleteFile" @context-menu="(e, file) => openContextMenu(e, file, 'file')" />
        </div>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-if="!loading && displayedSubfolders.length === 0 && displayedFiles.length === 0"
        icon="folder"
        :title="t('fileManager.emptyFolder')"
        :description="t('fileManager.emptyDesc')"
      />
    </div>

    <!-- Modals Wrapper -->
    <FileManagerModals
      ref="modals"
      :current-folder="currentFolder"
      :items-to-move="itemsToMove"
      :share-file="currentShareFile"
      @create-folder="handleCreateFolder"
      @rename="handleRenameSubmit"
      @moved="handleMoved"
      @share-updated="handleShareUpdated"
    />

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
import EmptyState from '@/components/ui/EmptyState.vue';
import ContextMenu from '@/components/ui/ContextMenu.vue';
import FolderGrid from './FolderGrid.vue';
import FileTable from './FileTable.vue';
import FileCards from './FileCards.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import FileManagerToolbar from './FileManagerToolbar.vue';
import FileManagerModals from './FileManagerModals.vue';

import { useFileManager } from '@/composables/useFileManager';
import { useI18n } from '@/composables/useI18n';
import { useSearch } from '@/composables/useSearch';
import { useToast } from '@/composables/useToast';
import { useUploadQueue } from '@/composables/useUploadQueue';

const { addToast } = useToast();
const { addFiles, registerFolderRefresh, unregisterFolderRefresh } = useUploadQueue();
const { t } = useI18n();

// Setup FileManager Composable
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
  batchDeleteFiles,
} = useFileManager();

const { searchQuery } = useSearch();

// Computed Data
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
const viewMode = ref('list');
const modals = ref(null); // Ref to FileManagerModals component
const itemsToMove = ref([]);
const currentShareFile = ref(null);
const selectedIds = ref(new Set());
const isDragging = ref(false);
const dragCounter = ref(0);

// Confirm Dialog State
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

// Context Menu State
const contextMenuData = ref({
  show: false,
  x: 0,
  y: 0,
  items: [],
});

// Navigation
const navigateTo = (id) => {
  if (selectedIds.value.size > 0) {
    selectedIds.value.clear();
  }
  loadFolderData(id);
};

// Handlers
const handleCreateFolder = async (name) => {
  await createFolder({ name });
};

const openCreateFolderModal = () => {
  modals.value?.openCreateFolder();
};

const openShareFolderModal = () => {
  modals.value?.openShareFolder();
};

const handleRenameSubmit = async ({ id, type, newName }) => {
  if (type === 'file') {
    await renameFile(id, newName);
  } else {
    await renameFolder(id, newName);
  }
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
  modals.value.openMove();
};

const handleMoveFile = (file) => {
  itemsToMove.value = [{ id: file.id, type: 'file' }];
  modals.value.openMove();
};

const handleMoveFolder = (folder) => {
  itemsToMove.value = [{ id: folder.id, type: 'folder' }];
  modals.value.openMove();
};

const handleMoved = () => {
  loadFolderData(currentFolder.value?.id);
  selectedIds.value.clear();
};

// Delete Actions
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

// Sharing
const handleShareFile = (file) => {
  currentShareFile.value = file;
  modals.value.openShareFile();
};

const handleShareUpdated = () => {
  loadFolderData(currentFolder.value?.id);
};

// Drag & Drop
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

const handleFileSelect = (files) => {
    if (!currentFolder.value) {
      addToast({ message: t('fileManager.selectFolderFirst'), type: 'warning' });
      return;
    }
    // Convert FileList to Array
    addFiles(Array.from(files), currentFolder.value.id);
};

// Auto Refresh
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

// Lifecycle
onMounted(() => {
  loadFolderData();
  window.addEventListener('click', () => contextMenuData.value.show = false);
});

onActivated(() => {
  loadFolderData(currentFolder.value?.id);
});

onUnmounted(() => {
    if (currentFolder.value?.id) {
        unregisterFolderRefresh(currentFolder.value.id);
    }
});

// Context Menu Logic
// Heroicons import removed in favor of local createIcon helper to avoid dependency issues
// Wait, I don't have heroicons installed probably? I should stick to the simple createIcon helper or usage I had before.
// Actually, I can just define the menu items with string icons or simple objects if ContextMenu supports it.
// The ContextMenu component likely expects objects. Reverting to the local icon definition pattern for safety.

const createIconPath = (d) => d; // Unused, can be removed
// It used a `createIcon` helper that returned a VNode.

import { h } from 'vue';
const createIcon = (d) => {
  return {
    render: () => h('svg', { class: 'size-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('path', { d })
    ])
  }
}

const Icons = {
  upload: createIcon('M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12'),
  folderPlus: createIcon('M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z'),
  refresh: createIcon('M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'),
  list: createIcon('M4 6h16M4 12h16M4 18h16'),
  grid: createIcon('M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'),
  open: createIcon('M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'),
  rename: createIcon('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'),
  move: createIcon('M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'),
  share: createIcon('M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z'),
  download: createIcon('M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'),
  delete: createIcon('M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'),
};

const openBackgroundContextMenu = (e) => {
  const menuItems = [
    { 
      label: t('fileManager.upload'), 
      icon: Icons.upload, 
      action: () => document.querySelector('input[type=file]')?.click() 
    },
    { 
      label: t('fileManager.newFolder'), 
      icon: Icons.folderPlus, 
      action: () => modals.value.openCreateFolder()
    },
    { type: 'separator' },
    { 
      label: t('header.refresh'), 
      icon: Icons.refresh, 
      action: () => loadFolderData(currentFolder.value?.id) 
    },
    { type: 'separator' },
    { 
      label: viewMode.value === 'list' ? t('fileManager.viewMode.grid') : t('fileManager.viewMode.list'), 
      icon: viewMode.value === 'list' ? Icons.grid : Icons.list, 
      action: () => viewMode.value = viewMode.value === 'list' ? 'grid' : 'list' 
    }
  ];

  contextMenuData.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    items: menuItems,
  };
};

const openContextMenu = (e, item, type) => {
  const menuItems = [
    { label: t('fileManager.contextMenu.open'), icon: Icons.open, action: () => type === 'folder' ? navigateTo(item.id) : window.open(item.url, '_blank') },
    { label: t('fileManager.contextMenu.rename'), icon: Icons.rename, action: () => modals.value.openRename({ id: item.id, type, name: item.name }) },
    { label: t('fileManager.contextMenu.move'), icon: Icons.move, action: () => type === 'folder' ? handleMoveFolder(item) : handleMoveFile(item) },
  ];

  if (type === 'file') {
    menuItems.push({ label: t('fileManager.contextMenu.share'), icon: Icons.share, action: () => handleShareFile(item) });
    menuItems.push({ label: t('fileManager.contextMenu.download'), icon: Icons.download, action: () => window.open(item.url, '_blank') });
  }
  
  menuItems.push({ type: 'separator' });
  menuItems.push({ 
    label: t('fileManager.contextMenu.delete'), 
    icon: Icons.delete, 
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

// Utils need to be imported or available.
// In <script setup>, imports are top level.
// We imported useFileManager which provides these.
const { formatSize, getFileExtension, isImage } = useFileManager();

</script>
