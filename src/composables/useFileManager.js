import { ref, onScopeDispose } from 'vue';
import { useToast } from './useToast';
import { useAuth } from './useAuth';
import { useI18n } from './useI18n';
import { formatSize, formatDate, getFileExtension, isImage } from '@/utils/formatters';
import { API } from '@/utils/constants';

export function useFileManager() {
  const toast = useToast();
  const { authFetch } = useAuth();
  const { t } = useI18n();

  // 状态
  const loading = ref(false);
  const error = ref(null);
  const errorCode = ref(null);
  const currentFolder = ref(null); // null = root
  const subfolders = ref([]);
  const files = ref([]);
  const breadcrumbs = ref([]);
  const selectedFiles = ref([]);

  const resolveErrorCode = (status, message = '') => {
    const normalized = String(message || '');
    if (Number(status) === 403 || normalized.includes('权限不足')) return 'FORBIDDEN';
    if (Number(status) === 401 || normalized.includes('未授权')) return 'UNAUTHORIZED';
    return null;
  };

  const setErrorState = (message, status = 0, options = {}) => {
    const { silent = false, toastMessage = null, setGlobal = true } = options;
    const code = resolveErrorCode(status, message);
    if (setGlobal) {
      errorCode.value = code;
      error.value = message || t('fileOps.loadFailed');
    }
    if (!silent && (!setGlobal || (code !== 'FORBIDDEN' && code !== 'UNAUTHORIZED'))) {
      toast.error(toastMessage || error.value);
    }
  };

  let abortController = null;

  // 组件卸载时取消请求
  onScopeDispose(() => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  });

  /**
   * 加载文件夹数据
   * @param {string|null} folderId - 文件夹ID，null表示根目录
   * @param {Object} options - 选项
   * @param {boolean} options.silent - 静默刷新，不显示loading状态
   */
  const loadFolderData = async (folderId = null, options = {}) => {
    const { silent = false } = options;

    if (!silent) {
      loading.value = true;
      error.value = null;
      errorCode.value = null;
      selectedFiles.value = [];
    }

    // 取消之前的请求
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    try {
      if (folderId) {
        const res = await authFetch(API.FOLDER_BY_ID(folderId), {
          signal: abortController.signal
        }).then((r) => r.json());
        if (res.success) {
          currentFolder.value = res.data;
          subfolders.value = res.data.subfolders;
          files.value = res.data.files;
          breadcrumbs.value = res.data.breadcrumbs || [];
        } else {
          setErrorState(res.message);
        }
      } else {
        // 根目录：并行加载文件夹和文件
        const [foldersRes, filesRes] = await Promise.all([
          authFetch(API.FOLDERS, { signal: abortController.signal }).then((r) => r.json()),
          authFetch(API.FILES, { signal: abortController.signal }).then((r) => r.json()),
        ]);

        if (foldersRes.success) {
          currentFolder.value = null;
          subfolders.value = foldersRes.data;
          breadcrumbs.value = [];
        } else {
          setErrorState(foldersRes.message);
        }

        if (filesRes.success && filesRes.data) {
          // /api/v1/files 返回 { data: [...], pagination: {...} }
          files.value = Array.isArray(filesRes.data) ? filesRes.data : filesRes.data.data;
        } else {
          files.value = [];
        }
      }
    } catch (_e) {
      if (_e.name === 'AbortError') return;
      const status = Number(_e?.status || 0);
      const msg = _e?.data?.error || _e?.message || t('fileOps.loadFailed');
      setErrorState(msg, status, { silent, toastMessage: t('fileOps.loadFailed') });
    } finally {
      if (!silent) {
        loading.value = false;
      }
    }
  };

  const createFolder = async (data) => {
    try {
      const payload = { ...data };
      if (!data.parentId && currentFolder.value) {
        payload.parentId = currentFolder.value.id;
      }

      const res = await authFetch(API.FOLDERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success) {
        toast.success(t('fileOps.folderCreateSuccess'));
        loadFolderData(currentFolder.value?.id);
        return true;
      } else {
        setErrorState(res.message, 0, { setGlobal: false });
        return false;
      }
    } catch (_e) {
      setErrorState(t('fileOps.createFailed'), 0, { setGlobal: false });
      return false;
    }
  };

  const updateFolder = async (id, data) => {
    try {
      const res = await authFetch(API.FOLDER_BY_ID(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json());

      if (res.success) {
        toast.success(t('fileOps.updateSuccess'));
        loadFolderData(currentFolder.value?.id);
        return true;
      } else {
        setErrorState(res.message, 0, { setGlobal: false });
        return false;
      }
    } catch (_e) {
      setErrorState(t('fileOps.updateFailed'), 0, { setGlobal: false });
      return false;
    }
  };

  const deleteFolder = async (id) => {
    try {
      const res = await authFetch(API.FOLDER_BY_ID(id), {
        method: 'DELETE',
      }).then((r) => r.json());

      if (res.success) {
        toast.success(t('fileOps.deleteSuccess'));
        if (currentFolder.value && currentFolder.value.id === id) {
          loadFolderData(currentFolder.value.parentId);
        } else {
          loadFolderData(currentFolder.value?.id);
        }
        return true;
      } else {
        setErrorState(res.message, 0, { setGlobal: false });
        return false;
      }
    } catch (_e) {
      setErrorState(t('fileOps.deleteFailed'), 0, { setGlobal: false });
      return false;
    }
  };

  const deleteFile = async (fileId) => {
    try {
      const res = await authFetch(`${API.FILES}/${fileId}`, {
        method: 'DELETE',
      }).then((r) => r.json());

      if (res.success) {
        toast.success(t('fileOps.fileDeleted'));
        // Refresh current view (works for root too since id will be null/undefined)
        loadFolderData(currentFolder.value?.id);
      } else {
        setErrorState(res.message, 0, { setGlobal: false });
      }
    } catch (_e) {
      setErrorState(t('fileOps.deleteFailed'), 0, { setGlobal: false });
    }
  };

  // 🔧 REMOVED: uploadFiles 函数已被 useUploadQueue 替代

  return {
    loading,
    error,
    errorCode,
    currentFolder,
    subfolders,
    files,
    breadcrumbs,
    selectedFiles,

    loadFolderData,
    createFolder,
    updateFolder,
    deleteFolder,
    deleteFile,

    // New Operations
    renameFile: async (id, name) => {
      try {
        const res = await authFetch(`${API.FILES}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        }).then((r) => r.json());

        if (res.success) {
          toast.success(t('fileOps.renameSuccess'));
          loadFolderData(currentFolder.value?.id);
          return true;
        } else {
          setErrorState(res.message, 0, { setGlobal: false });
          return false;
        }
      } catch (_e) {
        setErrorState(t('fileOps.renameFailed'), 0, { setGlobal: false });
        return false;
      }
    },

    renameFolder: async (id, name) => {
      return updateFolder(id, { name });
    },

    moveFolder: async (id, parentId) => {
      return updateFolder(id, { parentId });
    },

    batchDeleteFiles: async (ids) => {
      try {
        const res = await authFetch(`${API.FILES}/batch/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        }).then((r) => r.json());

        if (res.success) {
          toast.success(res.message);
          loadFolderData(currentFolder.value?.id);
          return true;
        } else {
          setErrorState(res.message, 0, { setGlobal: false });
          return false;
        }
      } catch (_e) {
        setErrorState(t('fileOps.deleteFailed'), 0, { setGlobal: false });
        return false;
      }
    },

    batchMoveFiles: async (ids, targetFolderId) => {
      try {
        const res = await authFetch(`${API.FILES}/batch/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, targetFolderId }),
        }).then((r) => r.json());

        if (res.success) {
          toast.success(res.message);
          loadFolderData(currentFolder.value?.id);
          return true;
        } else {
          setErrorState(res.message, 0, { setGlobal: false });
          return false;
        }
      } catch (_e) {
        setErrorState(t('fileOps.moveFailed'), 0, { setGlobal: false });
        return false;
      }
    },

    // 🗑️ 回收站操作
    loadTrashData: async (options = {}) => {
      const { silent = false } = options;
      if (!silent) {
        loading.value = true;
        error.value = null;
        errorCode.value = null;
        selectedFiles.value = [];
      }

      try {
        const res = await authFetch(API.TRASH).then((r) => r.json());
        if (res.success) {
          // 回收站模式下，files.value 存储回收站项目
          files.value = res.data;
          currentFolder.value = { isTrash: true, name: t('trash.title') };
          breadcrumbs.value = [{ name: t('trash.title'), path: '/admin/trash' }];
        } else {
          setErrorState(res.message, 0, { silent });
        }
      } catch (_e) {
        const status = Number(_e?.status || 0);
        const msg = _e?.data?.error || _e?.message || t('fileOps.loadFailed');
        setErrorState(msg, status, { silent, toastMessage: t('fileOps.loadFailed') });
      } finally {
        if (!silent) loading.value = false;
      }
    },

    restoreTrashItems: async (ids) => {
      try {
        const fileIds = ids.filter(id => files.value.find(f => f.id === id && f.type === 'file'));
        const folderIds = ids.filter(id => files.value.find(f => f.id === id && f.type === 'folder'));

        const res = await authFetch(API.TRASH_RESTORE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds, folderIds }),
        }).then((r) => r.json());

        if (res.success) {
          toast.success(t('trash.restoreSuccess'));
          // 重新加载回收站
          return true;
        } else {
          toast.error(res.message);
          return false;
        }
      } catch (_e) {
        toast.error(t('common.networkError'));
        return false;
      }
    },

    deleteTrashItems: async (ids) => {
      try {
        const fileIds = ids.filter(id => files.value.find(f => f.id === id && f.type === 'file'));
        const folderIds = ids.filter(id => files.value.find(f => f.id === id && f.type === 'folder'));

        const res = await authFetch(API.TRASH_DELETE, {
          method: 'POST', // 或 DELETE with body
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds, folderIds }),
        }).then((r) => r.json());

        if (res.success) {
          toast.success(t('trash.deleteSuccess'));
          return true;
        } else {
          toast.error(res.message);
          return false;
        }
      } catch (_e) {
        toast.error(t('common.networkError'));
        return false;
      }
    },

    emptyTrash: async () => {
      try {
        const res = await authFetch(API.TRASH_EMPTY, {
          method: 'DELETE',
        }).then((r) => r.json());

        if (res.success) {
          toast.success(t('trash.emptySuccess'));
          return true;
        } else {
          toast.error(res.message);
          return false;
        }
      } catch (_e) {
        toast.error(t('common.networkError'));
        return false;
      }
    },

    // 从 utils 导出的辅助函数
    isImage,
    getFileExtension,
    formatSize,
    formatDate,
  };
}
