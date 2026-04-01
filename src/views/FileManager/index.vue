<template>
  <ManagementListShell :title="t('sidebar.files')" :description="t('fileManager.filesHeader')">
  <template #content>
  <div
    class="relative flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <!-- Drag & Drop Overlay -->
    <transition name="fade">
      <div
        v-if="isDragging"
        class="border-info bg-info/10 pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed backdrop-blur-sm dark:bg-info/20"
      >
        <div class="mb-4 animate-bounce rounded-full bg-(--bg-card) p-6 shadow-lg">
          <AppIcon
            name="cloud-arrow-up"
            class="text-info size-12"
          />
        </div>
        <h3 class="text-2xl font-bold text-(--color-info-text)">
          {{ t('fileManager.dragDropTitle') }}
        </h3>
        <p class="text-info mt-2">{{ t('fileManager.dragDropDesc') }}</p>
      </div>
    </transition>

    <!-- Toolbar -->
    <FileManagerToolbar
      v-model:view-mode="viewMode"
      :breadcrumbs="breadcrumbs"
      :current-folder="currentFolder"
      :selected-count="selectedIds.size"
      :can-write-files="canWriteFiles"
      :can-delete-files="canDeleteFiles"
      :can-manage-folders="canManageFolders"
      :can-move-files="canMoveFiles"
      @navigate="navigateTo"
      @upload="handleFileSelect"
      @create-folder="openCreateFolderModal"
      @share-folder="openShareFolderModal"
      @batch-move="handleBatchMove"
      @batch-delete="handleBatchDelete"
      @batch-tag="handleBatchTag"
      @clear-selection="selectedIds.clear()"
      @open-trash="showTrashModal = true"
    />

    <!-- Error State -->
    <div v-if="errorCode === 'FORBIDDEN'" class="flex flex-1 flex-col items-center justify-center p-6">
      <PermissionDeniedState
        title="文件管理权限不足"
        :description="error || '当前账号没有文件管理读取权限，请联系管理员分配 files:read。'"
        required-permission="files:read"
        @retry="loadFolderData(currentFolder?.id)"
      />
    </div>
    <div v-else-if="error" class="flex flex-1 flex-col items-center justify-center p-6">
      <EmptyState
        icon="inbox"
        :title="t('common.error')"
        :description="error"
        type="danger"
      >
        <template #action>
          <AppButton
            variant="primary"
            :text="t('common.retry')"
            @click="loadFolderData(currentFolder?.id)"
          />
        </template>
      </EmptyState>
    </div>

    <!-- Folder Info & Select All -->
    <div
      v-if="currentFolder"
      class="flex items-center justify-between border-b border-(--border-color) bg-(--bg-muted) px-6 py-3 text-sm"
    >
      <div class="text-secondary flex items-center gap-4">
        <span>{{ t('fileManager.totalFiles', { count: displayedFiles.length }) }}</span>
        <span>{{ t('fileManager.totalFolders', { count: displayedSubfolders.length }) }}</span>
      </div>
       <div v-if="displayedFiles.length > 0 && viewMode === 'list'" class="hidden lg:block">
         <label class="text-secondary flex cursor-pointer items-center gap-2 hover:text-primary">
            <AppCheckbox :checked="selectedIds.size === displayedFiles.length && displayedFiles.length > 0" @change="selectAll" />
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
    <div v-else-if="!loading && !error" class="flex flex-1 flex-col" @contextmenu.prevent="openBackgroundContextMenu($event)">
      <!-- Subfolders -->
      <div v-if="displayedSubfolders.length > 0" class="p-4 pb-0 lg:p-6 lg:pb-0">
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
        class="m-4  h-px bg-(--border-color) lg:m-6 "
      ></div>

      <!-- Files -->
      <div v-if="displayedFiles.length > 0" class="flex-1 px-4 pt-0 pb-4 lg:px-6 lg:pb-6" @click="selectedIds.clear()">
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
                      class="group relative cursor-pointer rounded-xl border p-4 transition-all hover:-translate-y-1 hover:shadow-md"
                      :class="[
                        selectedIds.has(file.id)
                          ? 'border-primary bg-primary/10 ring-primary ring-1 dark:bg-primary/20'
                          : 'border-(--border-color) bg-(--bg-card) hover:border-(--border-hover)'
                      ]"
                       @click.stop="toggleSelect(file)"
                       @dblclick="window.open(file.url, '_blank')"
                       @contextmenu.prevent.stop="openContextMenu($event, file, 'file')"
                    >
                         <div class="flex flex-col items-center">
                             <AppImage
                               v-if="isImage(file)"
                               :src="file.url"
                               class="mb-2 size-20 shadow-sm"
                               fit="cover"
                             />
                              <div
                               v-else
                               class="mb-2 flex size-20 items-center justify-center rounded bg-(--bg-muted) text-sm font-bold text-(--text-secondary) uppercase dark:bg-white/10"
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
        v-if="displayedSubfolders.length === 0 && displayedFiles.length === 0"
        :icon="searchQuery ? 'search' : 'folder'"
        :title="searchQuery ? t('common.noSearchResults') : t('fileManager.emptyFolder')"
        :description="searchQuery ? t('common.noResultsDesc', { query: searchQuery }) : t('fileManager.emptyDesc')"
      >
        <template v-if="searchQuery" #action>
          <AppButton
            variant="secondary"
            :text="t('common.clearSearch')"
            @click="searchQuery = ''"
          />
        </template>
      </EmptyState>
    </div>

    <!-- Modals Wrapper -->
    <FileManagerModals
      ref="modals"
      :current-folder="currentFolder"
      :items-to-move="itemsToMove"
      :items-to-tag="itemsToTag"
      :share-file="currentShareFile"
      @create-folder="handleCreateFolder"
      @rename="handleRenameSubmit"
      @moved="handleMoved"
      @tagged="handleTagged"
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

    <!-- Recycling Bin Modal -->
    <TrashModal v-model="showTrashModal" @change="loadFolderData(currentFolder?.id)" />
  </div>
  </template>
  </ManagementListShell>
</template>

<script setup>
import { onMounted, ref, onUnmounted, onActivated, watch, computed, useTemplateRef, onWatcherCleanup } from 'vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ContextMenu from '@/components/ui/ContextMenu.vue';
import FolderGrid from './FolderGrid.vue';
import FileTable from './FileTable.vue';
import FileCards from './FileCards.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import FileManagerToolbar from './FileManagerToolbar.vue';
import FileManagerModals from './FileManagerModals.vue';
import TrashModal from './TrashModal.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';

import { useFileManager } from '@/composables/useFileManager';
import { useI18n } from '@/composables/useI18n';
import { useSearch } from '@/composables/useSearch';
import { useToast } from '@/composables/useToast';
import { useUploadQueue } from '@/composables/useUploadQueue';
import { useAccessControl } from '@/composables/useAccessControl';
import { useFileDrag } from '@/composables/file-manager/useFileDrag';
import { useFileSelection } from '@/composables/file-manager/useFileSelection';
import { useFileNavigation } from '@/composables/file-manager/useFileNavigation';

const { addToast } = useToast();
const { addFiles, registerFolderRefresh, unregisterFolderRefresh } = useUploadQueue();
const { t } = useI18n();
const { hasPermission, loadPermissions } = useAccessControl();

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
  formatSize, 
  getFileExtension, 
  isImage,
  error,
  errorCode,
} = useFileManager();

const { searchQuery, searchResults } = useSearch();

// Computed Data
const displayedSubfolders = computed(() => {
  if (!searchQuery.value) return subfolders.value;
  const query = searchQuery.value.toLowerCase();
  return subfolders.value.filter((f) => f.name.toLowerCase().includes(query));
});

const displayedFiles = computed(() => {
  if (!searchQuery.value) return files.value;
  // If actively searching globally:
  return searchResults.value.map(file => {
    // Re-map format if necessary, assuming server returns standard file obj
    return {
      ...file,
      url: `/api/v1/files/${file.id}` // basic standard resolution mapping 
    };
  });
});

// Setup New Composables
const { 
  selectedIds, 
  toggleSelect, 
  selectAll, 
  clearSelection 
} = useFileSelection(displayedFiles);

const { navigateTo } = useFileNavigation(loadFolderData, clearSelection);

const handleFilesDropped = (droppedFiles) => {
   addFiles(droppedFiles, currentFolder.value?.id);
};

const { 
  isDragging, 
  onDragEnter, 
  onDragLeave, 
  onDragOver, 
  onDrop 
} = useFileDrag(currentFolder, handleFilesDropped);

// UI State
const viewMode = ref('list');
const modals = useTemplateRef('modals'); // Ref to FileManagerModals component
const showTrashModal = ref(false); // NEW
const itemsToMove = ref([]);
const itemsToTag = ref([]);
const currentShareFile = ref(null);
const canWriteFiles = ref(false);
const canDeleteFiles = ref(false);
const canBrowseFolders = ref(false);
const canManageFolders = ref(false);
const canDeleteFolders = ref(false);
const canMoveFiles = ref(false);

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

// Handlers
const handleCreateFolder = async (name) => {
  if (!canManageFolders.value) return;
  await createFolder({ name });
};

const openCreateFolderModal = () => {
  if (!canManageFolders.value) return;
  modals.value?.openCreateFolder();
};

const openShareFolderModal = (folder = null) => {
  if (!canManageFolders.value) return;
  modals.value?.openShareFolder(folder);
};

const handleRenameSubmit = async ({ id, type, newName }) => {
  if (type === 'file') {
    if (!canWriteFiles.value) return;
    await renameFile(id, newName);
  } else {
    if (!canManageFolders.value) return;
    await renameFolder(id, newName);
  }
};

// Batch Actions
const handleBatchDelete = () => {
  if (!canDeleteFiles.value) return;
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
  if (!canMoveFiles.value) return;
  if (selectedIds.value.size === 0) return;
  itemsToMove.value = Array.from(selectedIds.value).map(id => ({ id, type: 'file' }));
  modals.value.openMove();
};

const handleBatchTag = () => {
  if (!canWriteFiles.value) return;
  if (selectedIds.value.size === 0) return;
  // Tags only apply to files currently, but could check type if needed
  itemsToTag.value = Array.from(selectedIds.value).map(id => {
    // find the file to pass its existing metadata if needed
    const file = files.value.find(f => f.id === id);
    return file || { id, type: 'file' };
  });
  modals.value.openTag();
};

const handleMoveFile = (file) => {
  if (!canMoveFiles.value) return;
  itemsToMove.value = [{ id: file.id, type: 'file' }];
  modals.value.openMove();
};

const handleMoveFolder = (folder) => {
  if (!canManageFolders.value) return;
  itemsToMove.value = [{ id: folder.id, type: 'folder' }];
  modals.value.openMove();
};

const handleMoved = () => {
  loadFolderData(currentFolder.value?.id);
  selectedIds.value.clear();
};

const handleTagged = () => {
  loadFolderData(currentFolder.value?.id);
  selectedIds.value.clear();
};

// Delete Actions
const handleDeleteFile = (file) => {
  if (!canDeleteFiles.value) return;
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
  if (!canDeleteFolders.value) return;
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

const handleFileSelect = (files) => {
    if (!canWriteFiles.value) return;
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
  (newFolder) => {
    selectedIds.value.clear();
    if (newFolder?.id) {
      registerFolderRefresh(newFolder.id, () => {
        loadFolderData(newFolder.id, { silent: true });
      });
      onWatcherCleanup(() => {
        unregisterFolderRefresh(newFolder.id);
      });
    }
  },
  { immediate: true }
);

// Lifecycle
onMounted(() => {
  loadPermissions().then(() => {
    canWriteFiles.value = hasPermission('files:write');
    canDeleteFiles.value = hasPermission('files:delete');
    canBrowseFolders.value = hasPermission('folders:read');
    canManageFolders.value = hasPermission('folders:write');
    canDeleteFolders.value = hasPermission('folders:delete');
    canMoveFiles.value = canWriteFiles.value && canBrowseFolders.value;
  });
  loadFolderData();
  window.addEventListener('click', () => contextMenuData.value.show = false);
});

onActivated(() => {
  loadPermissions().then(() => {
    canWriteFiles.value = hasPermission('files:write');
    canDeleteFiles.value = hasPermission('files:delete');
    canBrowseFolders.value = hasPermission('folders:read');
    canManageFolders.value = hasPermission('folders:write');
    canDeleteFolders.value = hasPermission('folders:delete');
    canMoveFiles.value = canWriteFiles.value && canBrowseFolders.value;
  });
  loadFolderData(currentFolder.value?.id);
});

onUnmounted(() => {
  // Cleanup handled by onWatcherCleanup
});

// Context Menu Logic
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
      label: t('header.refresh'), 
      icon: Icons.refresh, 
      action: () => loadFolderData(currentFolder.value?.id) 
    },
    { 
      label: viewMode.value === 'list' ? t('fileManager.viewMode.grid') : t('fileManager.viewMode.list'), 
      icon: viewMode.value === 'list' ? Icons.grid : Icons.list, 
      action: () => viewMode.value = viewMode.value === 'list' ? 'grid' : 'list' 
    }
  ];

  if (canWriteFiles.value) {
    menuItems.unshift({
      label: t('fileManager.upload'),
      icon: Icons.upload,
      action: () => document.querySelector('input[type=file]')?.click(),
    });
  }

  if (canManageFolders.value) {
    menuItems.splice(canWriteFiles.value ? 1 : 0, 0, {
      label: t('fileManager.newFolder'),
      icon: Icons.folderPlus,
      action: () => modals.value.openCreateFolder(),
    });
  }

  if (canWriteFiles.value || canManageFolders.value) {
    menuItems.splice((canWriteFiles.value ? 1 : 0) + (canManageFolders.value ? 1 : 0), 0, { type: 'separator' });
  }

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
  ];

  if (type === 'file') {
    if (canWriteFiles.value) {
      menuItems.push({ label: t('fileManager.contextMenu.rename'), icon: Icons.rename, action: () => modals.value.openRename({ id: item.id, type, name: item.name }) });
    }
    if (canMoveFiles.value) {
      menuItems.push({ label: t('fileManager.contextMenu.move'), icon: Icons.move, action: () => handleMoveFile(item) });
    }
    menuItems.push({ label: t('fileManager.contextMenu.share'), icon: Icons.share, action: () => handleShareFile(item) });
    menuItems.push({ label: t('fileManager.contextMenu.download'), icon: Icons.download, action: () => window.open(item.url, '_blank') });
  } else if (canManageFolders.value) {
    // Folder actions
    menuItems.push({ label: t('fileManager.contextMenu.rename'), icon: Icons.rename, action: () => modals.value.openRename({ id: item.id, type, name: item.name }) });
    menuItems.push({ label: t('fileManager.contextMenu.move'), icon: Icons.move, action: () => handleMoveFolder(item) });
    menuItems.push({ label: t('fileManager.contextMenu.share'), icon: Icons.share, action: () => openShareFolderModal(item) });
  }

  if ((type === 'file' && canDeleteFiles.value) || (type === 'folder' && canDeleteFolders.value)) {
    menuItems.push({ type: 'separator' });
    menuItems.push({ 
      label: t('fileManager.contextMenu.delete'), 
      icon: Icons.delete, 
      danger: true, 
      action: () => type === 'folder' ? handleDeleteFolder(item) : handleDeleteFile(item) 
    });
  }

  contextMenuData.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    items: menuItems,
  };
};
</script>
