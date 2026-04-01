import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import FileManager from '../FileManager/index.vue';

const mocks = vi.hoisted(() => ({
  loadFolderData: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  renameFolder: vi.fn(),
  batchDeleteFiles: vi.fn(),
  addToast: vi.fn(),
  addFiles: vi.fn(),
  registerFolderRefresh: vi.fn(),
  unregisterFolderRefresh: vi.fn(),
  loadPermissions: vi.fn(),
  hasPermission: vi.fn(),
}));

const loading = ref(false);
const currentFolder = ref(null);
const subfolders = ref([]);
const files = ref([]);
const breadcrumbs = ref([]);
const error = ref(null);
const errorCode = ref(null);
const searchQuery = ref('');
const searchResults = ref([]);

vi.mock('@/composables/useFileManager', () => ({
  useFileManager: () => ({
    loading,
    currentFolder,
    subfolders,
    files,
    breadcrumbs,
    loadFolderData: mocks.loadFolderData,
    createFolder: mocks.createFolder,
    deleteFolder: mocks.deleteFolder,
    deleteFile: mocks.deleteFile,
    renameFile: mocks.renameFile,
    renameFolder: mocks.renameFolder,
    batchDeleteFiles: mocks.batchDeleteFiles,
    formatSize: () => '1 KB',
    getFileExtension: () => 'PDF',
    isImage: () => false,
    error,
    errorCode,
  }),
}));

vi.mock('@/composables/useAccessControl', () => ({
  useAccessControl: () => ({
    loadPermissions: mocks.loadPermissions,
    hasPermission: mocks.hasPermission,
  }),
}));

vi.mock('@/composables/useSearch', () => ({
  useSearch: () => ({
    searchQuery,
    searchResults,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast: mocks.addToast,
  }),
}));

vi.mock('@/composables/useUploadQueue', () => ({
  useUploadQueue: () => ({
    addFiles: mocks.addFiles,
    registerFolderRefresh: mocks.registerFolderRefresh,
    unregisterFolderRefresh: mocks.unregisterFolderRefresh,
  }),
}));

vi.mock('@/composables/file-manager/useFileDrag', () => ({
  useFileDrag: () => ({
    isDragging: ref(false),
    onDragEnter: vi.fn(),
    onDragLeave: vi.fn(),
    onDragOver: vi.fn(),
    onDrop: vi.fn(),
  }),
}));

vi.mock('@/composables/file-manager/useFileSelection', () => ({
  useFileSelection: () => ({
    selectedIds: ref(new Set()),
    toggleSelect: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
  }),
}));

vi.mock('@/composables/file-manager/useFileNavigation', () => ({
  useFileNavigation: () => ({
    navigateTo: vi.fn(),
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

describe('FileManager permission menu alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loading.value = false;
    currentFolder.value = null;
    subfolders.value = [];
    files.value = [];
    breadcrumbs.value = [];
    error.value = null;
    errorCode.value = null;
    searchQuery.value = '';
    searchResults.value = [];
    mocks.loadFolderData.mockResolvedValue(undefined);
    mocks.loadPermissions.mockResolvedValue([]);
    mocks.hasPermission.mockImplementation((permission) => permission === 'files:read');
  });

  function createWrapper() {
    return mount(FileManager, {
      global: {
        stubs: {
          ManagementListShell: { template: '<div><slot name="content" /></div>' },
          EmptyState: { template: '<div><slot name="action" /></div>' },
          ContextMenu: { template: '<div />' },
          FolderGrid: { template: '<div />' },
          FileTable: { template: '<div />' },
          FileCards: { template: '<div />' },
          Skeleton: { template: '<div />' },
          ConfirmDialog: { template: '<div />' },
          FileManagerToolbar: { template: '<div />' },
          FileManagerModals: { template: '<div />' },
          TrashModal: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppIcon: { template: '<div />' },
          AppCheckbox: { template: '<div />' },
          PermissionDeniedState: { template: '<div />' },
          AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
        },
      },
    });
  }

  it('omits write actions from background and file menus for read-only users', async () => {
    const wrapper = createWrapper();
    await flushPromises();

    wrapper.vm.openBackgroundContextMenu({ clientX: 10, clientY: 20 });
    const backgroundLabels = wrapper.vm.contextMenuData.items
      .filter((item) => item.label)
      .map((item) => item.label);

    expect(backgroundLabels).not.toContain('fileManager.upload');
    expect(backgroundLabels).not.toContain('fileManager.newFolder');

    wrapper.vm.openContextMenu({ clientX: 10, clientY: 20 }, { id: 'file-1', url: '/f/1' }, 'file');
    const fileLabels = wrapper.vm.contextMenuData.items
      .filter((item) => item.label)
      .map((item) => item.label);

    expect(fileLabels).not.toContain('fileManager.contextMenu.rename');
    expect(fileLabels).not.toContain('fileManager.contextMenu.move');
    expect(fileLabels).not.toContain('fileManager.contextMenu.delete');
    expect(fileLabels).toContain('fileManager.contextMenu.share');
    expect(fileLabels).toContain('fileManager.contextMenu.download');
  });
});
