import { ref, onScopeDispose } from 'vue';
import { useToast } from './useToast';
import { useAuth } from './useAuth';
import { useI18n } from './useI18n';
import { formatSize, formatDate, getFileExtension, isImage } from '@/utils/formatters';
import { API } from '@/utils/constants';
import { classifyError, extractErrorMessage } from '@/utils/api-helpers';
import { ErrorCode, isAuthError } from '@/utils/error-codes';

/** 文件夹信息接口 */
interface FolderInfo {
  id: string;
  name: string;
  parentId?: string;
  isTrash?: boolean;
  [key: string]: unknown;
}

/** 面包屑项接口 */
interface Breadcrumb {
  id?: string;
  name: string;
  path?: string;
  [key: string]: unknown;
}

/** 文件/文件夹列表项接口 */
interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  url?: string;
  size?: number;
  [key: string]: unknown;
}

/** 后端 API 通用响应结构 */
interface ApiResponse {
  success: boolean;
  message?: string;
  data?: FolderInfo | FileItem[] | Record<string, unknown> | Record<string, unknown>[];
  [key: string]: unknown;
}

/** 文件夹详情响应 */
interface FolderDetailResponse {
  success: boolean;
  message?: string;
  data?: {
    id: string;
    name: string;
    parentId?: string;
    subfolders: FileItem[];
    files: FileItem[];
    breadcrumbs: Breadcrumb[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** 回收站响应 */
interface TrashResponse {
  success: boolean;
  message?: string;
  data?: FileItem[];
  [key: string]: unknown;
}

export function useFileManager() {
  const toast = useToast();
  const { authFetch } = useAuth();
  const { t } = useI18n();

  // 状态
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const errorCode = ref<string | null>(null);
  const currentFolder = ref<FolderInfo | null>(null); // null = root
  const subfolders = ref<FileItem[]>([]);
  const files = ref<FileItem[]>([]);
  const breadcrumbs = ref<Breadcrumb[]>([]);
  const selectedFiles = ref<FileItem[]>([]);

  const resolveErrorCode = (status: number, _message: string = ''): string | null => {
    const code = classifyError({ status });
    if (code === ErrorCode.FORBIDDEN || code === ErrorCode.UNAUTHORIZED) return code;
    return null;
  };

  const getErrorMessage = (err: unknown): string => extractErrorMessage(err, t('fileOps.loadFailed'));
  const isForbiddenError = (status: number, _message: string = ''): boolean =>
    resolveErrorCode(status, _message) === ErrorCode.FORBIDDEN;
  const normalizeFileList = (payload: unknown): FileItem[] => {
    if (Array.isArray(payload)) return payload as FileItem[];
    if (payload && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as Record<string, unknown>).data)) {
      return (payload as Record<string, FileItem[]>).data;
    }
    return [];
  };

  const setErrorState = (message: string, status: number = 0, options: Record<string, unknown> = {}): void => {
    const { silent = false, toastMessage = null, setGlobal = true } = options;
    const code = resolveErrorCode(status, message);
    if (setGlobal) {
      errorCode.value = code;
      error.value = message || t('fileOps.loadFailed');
    }
    if (!silent && (!setGlobal || !isAuthError(code))) {
      toast.error((toastMessage as string) || message || error.value || t('fileOps.loadFailed'));
    }
  };

  let abortController: AbortController | null = null;

  // 组件卸载时取消请求
  onScopeDispose(() => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  });

  /**
   * 加载文件夹数据
   * @param folderId - 文件夹ID，null表示根目录
   * @param options - 选项
   */
  const loadFolderData = async (folderId: string | null = null, options: Record<string, unknown> = {}): Promise<void> => {
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
        const res: FolderDetailResponse = await authFetch(API.FOLDER_BY_ID(folderId), {
          signal: abortController.signal
        }).then((r) => r.json());
        if (res.success && res.data) {
          currentFolder.value = { id: res.data.id, name: res.data.name, parentId: res.data.parentId };
          subfolders.value = res.data.subfolders;
          files.value = res.data.files;
          breadcrumbs.value = res.data.breadcrumbs || [];
        } else {
          setErrorState(res.message || '');
        }
      } else {
        currentFolder.value = null;
        breadcrumbs.value = [];

        // 根目录：文件读取必须成功，文件夹列表按权限降级
        const [foldersRes, filesRes] = await Promise.allSettled([
          authFetch(API.FOLDERS, { signal: abortController.signal }).then((r) => r.json()),
          authFetch(API.FILES, { signal: abortController.signal }).then((r) => r.json()),
        ]);

        if (foldersRes.status === 'rejected' && foldersRes.reason instanceof Error && foldersRes.reason.name === 'AbortError') return;
        if (filesRes.status === 'rejected' && filesRes.reason instanceof Error && filesRes.reason.name === 'AbortError') return;

        let folderError: { status: number; message: string } | null = null;

        if (foldersRes.status === 'fulfilled' && foldersRes.value && typeof foldersRes.value === 'object' && 'success' in foldersRes.value && (foldersRes.value as ApiResponse).success) {
          subfolders.value = ((foldersRes.value as ApiResponse).data as FileItem[]) || [];
        } else {
          subfolders.value = [];
          if (foldersRes.status === 'fulfilled') {
            folderError = {
              status: 0,
              message: (foldersRes.value as ApiResponse)?.message || t('fileOps.loadFailed'),
            };
          } else {
            folderError = {
              status: (typeof foldersRes.reason === 'object' && foldersRes.reason !== null && 'status' in foldersRes.reason) ? Number((foldersRes.reason as Record<string, unknown>).status) : 0,
              message: getErrorMessage(foldersRes.reason),
            };
          }
        }

        if (filesRes.status === 'fulfilled' && filesRes.value && typeof filesRes.value === 'object' && 'success' in filesRes.value && (filesRes.value as ApiResponse).success) {
          files.value = normalizeFileList((filesRes.value as ApiResponse).data);
        } else {
          const status = filesRes.status === 'fulfilled' ? 0 : (typeof filesRes.reason === 'object' && filesRes.reason !== null && 'status' in filesRes.reason) ? Number((filesRes.reason as Record<string, unknown>).status) : 0;
          const msg = filesRes.status === 'fulfilled'
            ? (filesRes.value as ApiResponse)?.message || t('fileOps.loadFailed')
            : getErrorMessage(filesRes.reason);
          files.value = [];
          setErrorState(msg, status, { silent, toastMessage: t('fileOps.loadFailed') });
          return;
        }

        if (folderError && !isForbiddenError(folderError.status, folderError.message)) {
          setErrorState(folderError.message, folderError.status, {
            silent,
            toastMessage: t('fileOps.loadFailed'),
            setGlobal: false,
          });
        }
      }
    } catch (_e: unknown) {
      if (_e instanceof Error && _e.name === 'AbortError') return;
      const status = (typeof _e === 'object' && _e !== null && 'status' in _e) ? Number((_e as Record<string, unknown>).status) : 0;
      const msg = getErrorMessage(_e);
      setErrorState(msg, status, { silent, toastMessage: t('fileOps.loadFailed') });
    } finally {
      if (!silent) {
        loading.value = false;
      }
    }
  };

  const createFolder = async (data: Record<string, unknown>): Promise<boolean> => {
    try {
      const payload = { ...data };
      if (!data.parentId && currentFolder.value) {
        payload.parentId = currentFolder.value.id;
      }

      const res: ApiResponse = await authFetch(API.FOLDERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success) {
        toast.success(t('fileOps.folderCreateSuccess'));
        loadFolderData(currentFolder.value?.id);
        return true;
      } else {
        setErrorState(res.message || '', 0, { setGlobal: false });
        return false;
      }
    } catch (_e: unknown) {
      setErrorState(t('fileOps.createFailed'), 0, { setGlobal: false });
      return false;
    }
  };

  const updateFolder = async (id: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res: ApiResponse = await authFetch(API.FOLDER_BY_ID(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json());

      if (res.success) {
        toast.success(t('fileOps.updateSuccess'));
        loadFolderData(currentFolder.value?.id);
        return true;
      } else {
        setErrorState(res.message || '', 0, { setGlobal: false });
        return false;
      }
    } catch (_e: unknown) {
      setErrorState(t('fileOps.updateFailed'), 0, { setGlobal: false });
      return false;
    }
  };

  const deleteFolder = async (id: string): Promise<boolean> => {
    try {
      const res: ApiResponse = await authFetch(API.FOLDER_BY_ID(id), {
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
        setErrorState(res.message || '', 0, { setGlobal: false });
        return false;
      }
    } catch (_e: unknown) {
      setErrorState(t('fileOps.deleteFailed'), 0, { setGlobal: false });
      return false;
    }
  };

  const deleteFile = async (fileId: string): Promise<void> => {
    try {
      const res: ApiResponse = await authFetch(`${API.FILES}/${fileId}`, {
        method: 'DELETE',
      }).then((r) => r.json());

      if (res.success) {
        toast.success(t('fileOps.fileDeleted'));
        // Refresh current view (works for root too since id will be null/undefined)
        loadFolderData(currentFolder.value?.id);
      } else {
        setErrorState(res.message || '', 0, { setGlobal: false });
      }
    } catch (_e: unknown) {
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
    renameFile: async (id: string, name: string): Promise<boolean> => {
      try {
        const res: ApiResponse = await authFetch(`${API.FILES}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        }).then((r) => r.json());

        if (res.success) {
          toast.success(t('fileOps.renameSuccess'));
          loadFolderData(currentFolder.value?.id);
          return true;
        } else {
          setErrorState(res.message || '', 0, { setGlobal: false });
          return false;
        }
      } catch (_e: unknown) {
        setErrorState(t('fileOps.renameFailed'), 0, { setGlobal: false });
        return false;
      }
    },

    renameFolder: async (id: string, name: string): Promise<boolean> => {
      return updateFolder(id, { name });
    },

    moveFolder: async (id: string, parentId: string): Promise<boolean> => {
      return updateFolder(id, { parentId });
    },

    batchDeleteFiles: async (ids: string[]): Promise<boolean> => {
      try {
        const res: ApiResponse = await authFetch(`${API.FILES}/batch/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        }).then((r) => r.json());

        if (res.success) {
          toast.success(res.message || '');
          loadFolderData(currentFolder.value?.id);
          return true;
        } else {
          setErrorState(res.message || '', 0, { setGlobal: false });
          return false;
        }
      } catch (_e: unknown) {
        setErrorState(t('fileOps.deleteFailed'), 0, { setGlobal: false });
        return false;
      }
    },

    batchMoveFiles: async (ids: string[], targetFolderId: string): Promise<boolean> => {
      try {
        const res: ApiResponse = await authFetch(`${API.FILES}/batch/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, targetFolderId }),
        }).then((r) => r.json());

        if (res.success) {
          toast.success(res.message || '');
          loadFolderData(currentFolder.value?.id);
          return true;
        } else {
          setErrorState(res.message || '', 0, { setGlobal: false });
          return false;
        }
      } catch (_e: unknown) {
        setErrorState(t('fileOps.moveFailed'), 0, { setGlobal: false });
        return false;
      }
    },

    // 🗑️ 回收站操作
    loadTrashData: async (options: Record<string, unknown> = {}): Promise<void> => {
      const { silent = false } = options;
      if (!silent) {
        loading.value = true;
        error.value = null;
        errorCode.value = null;
        selectedFiles.value = [];
      }

      try {
        const res: TrashResponse = await authFetch(API.TRASH).then((r) => r.json());
        if (res.success && Array.isArray(res.data)) {
          // 回收站模式下，files.value 存储回收站项目
          files.value = res.data;
          currentFolder.value = { id: 'trash', isTrash: true, name: t('trash.title') };
          breadcrumbs.value = [{ name: t('trash.title'), path: '/admin/trash' }];
        } else {
          setErrorState(res.message || '', 0, { silent });
        }
      } catch (_e: unknown) {
        const status = (typeof _e === 'object' && _e !== null && 'status' in _e) ? Number((_e as Record<string, unknown>).status) : 0;
        const msg = getErrorMessage(_e);
        setErrorState(msg, status, { silent, toastMessage: t('fileOps.loadFailed') });
      } finally {
        if (!silent) loading.value = false;
      }
    },

    restoreTrashItems: async (ids: string[]): Promise<boolean> => {
      try {
        const fileIds = ids.filter((id: string) => files.value.find((f) => f.id === id && f.type === 'file'));
        const folderIds = ids.filter((id: string) => files.value.find((f) => f.id === id && f.type === 'folder'));

        const res: ApiResponse = await authFetch(API.TRASH_RESTORE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds, folderIds }),
        }).then((r) => r.json());

        if (res.success) {
          toast.success(t('trash.restoreSuccess'));
          // 重新加载回收站
          return true;
        } else {
          toast.error(res.message || '');
          return false;
        }
      } catch (_e: unknown) {
        toast.error(t('common.networkError'));
        return false;
      }
    },

    deleteTrashItems: async (ids: string[]): Promise<boolean> => {
      try {
        const fileIds = ids.filter((id: string) => files.value.find((f) => f.id === id && f.type === 'file'));
        const folderIds = ids.filter((id: string) => files.value.find((f) => f.id === id && f.type === 'folder'));

        const res: ApiResponse = await authFetch(API.TRASH_DELETE, {
          method: 'POST', // 或 DELETE with body
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds, folderIds }),
        }).then((r) => r.json());

        if (res.success) {
          toast.success(t('trash.deleteSuccess'));
          return true;
        } else {
          toast.error(res.message || '');
          return false;
        }
      } catch (_e: unknown) {
        toast.error(t('common.networkError'));
        return false;
      }
    },

    emptyTrash: async (): Promise<boolean> => {
      try {
        const res: ApiResponse = await authFetch(API.TRASH_EMPTY, {
          method: 'DELETE',
        }).then((r) => r.json());

        if (res.success) {
          toast.success(t('trash.emptySuccess'));
          return true;
        } else {
          toast.error(res.message || '');
          return false;
        }
      } catch (_e: unknown) {
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
