import { ref } from 'vue';
import { useToast } from './useToast';
import { useAuth } from './useAuth';
import { formatSize, formatDate, getFileExtension, isImage } from '@/utils/formatters';
import { API } from '@/utils/constants';

export function useFileManager() {
    const { error, success } = useToast();
    const { authFetch } = useAuth();

    // 状态
    const loading = ref(false);
    const currentFolder = ref(null); // null = root
    const subfolders = ref([]);
    const files = ref([]);
    const breadcrumbs = ref([]);
    const selectedFiles = ref([]);

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
            selectedFiles.value = [];
        }

        try {
            if (folderId) {
                const res = await authFetch(API.FOLDER_BY_ID(folderId)).then(r => r.json());
                if (res.success) {
                    currentFolder.value = res.data;
                    subfolders.value = res.data.subfolders;
                    files.value = res.data.files;
                    breadcrumbs.value = res.data.breadcrumbs || [];
                } else {
                    error(res.message);
                }
            } else {
                // 根目录：并行加载文件夹和文件
                const [foldersRes, filesRes] = await Promise.all([
                    authFetch(API.FOLDERS).then(r => r.json()),
                    authFetch(API.FILES).then(r => r.json())
                ]);

                if (foldersRes.success) {
                    currentFolder.value = null;
                    subfolders.value = foldersRes.data;
                    breadcrumbs.value = [];
                } else {
                    error(foldersRes.message);
                }

                if (filesRes.success && filesRes.data) {
                    // /api/v1/files 返回 { data: [...], pagination: {...} }
                    files.value = Array.isArray(filesRes.data) ? filesRes.data : filesRes.data.data;
                } else {
                    files.value = [];
                }
            }
        } catch (e) {
            console.error(e);
            if (!silent) {
                error('加载失败');
            }
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
                body: JSON.stringify(payload)
            }).then(r => r.json());

            if (res.success) {
                success('文件夹创建成功');
                loadFolderData(currentFolder.value?.id);
                return true;
            } else {
                error(res.message);
                return false;
            }
        } catch (e) {
            error('创建失败');
            return false;
        }
    };

    const updateFolder = async (id, data) => {
        try {
            const res = await authFetch(API.FOLDER_BY_ID(id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(r => r.json());

            if (res.success) {
                success('更新成功');
                loadFolderData(currentFolder.value?.id);
                return true;
            } else {
                error(res.message);
                return false;
            }
        } catch (e) {
            error('更新失败');
            return false;
        }
    };

    const deleteFolder = async (id) => {
        try {
            const res = await authFetch(API.FOLDER_BY_ID(id), {
                method: 'DELETE'
            }).then(r => r.json());

            if (res.success) {
                success('删除成功');
                if (currentFolder.value && currentFolder.value.id === id) {
                    loadFolderData(currentFolder.value.parentId);
                } else {
                    loadFolderData(currentFolder.value?.id);
                }
                return true;
            } else {
                error(res.message);
                return false;
            }
        } catch (e) {
            error('删除失败');
            return false;
        }
    };

    const deleteFile = async (fileId) => {
        if (!currentFolder.value) return;
        try {
            const res = await authFetch(`${API.FOLDER_BY_ID(currentFolder.value.id)}?file_id=${fileId}`, {
                method: 'DELETE'
            }).then(r => r.json());

            if (res.success) {
                success('文件已删除');
                loadFolderData(currentFolder.value.id);
            } else {
                error(res.message);
            }
        } catch (e) {
            error('删除失败');
        }
    };

    // 🔧 REMOVED: uploadFiles 函数已被 useUploadQueue 替代

    return {
        loading,
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

        // 从 utils 导出的辅助函数
        isImage,
        getFileExtension,
        formatSize,
        formatDate
    };
}
