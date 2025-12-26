import { ref, computed } from 'vue';
import { useToast } from './useToast';

export function useFileManager() {
    const { error, success } = useToast();

    // 状态
    const loading = ref(false);
    const currentFolder = ref(null); // null = root
    const subfolders = ref([]);
    const files = ref([]);
    const breadcrumbs = ref([]);
    const selectedFiles = ref([]);

    // 计算属性
    const isImage = (file) => {
        if (file.type === 'image') return true;
        const ext = getFileExtension(file.name || file.originalName).toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
    };

    const getFileExtension = (filename) => {
        if (!filename) return '';
        return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toUpperCase();
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        // 兼容 API 返回可能是一个字符串或数字
        const date = new Date(Number(timestamp));
        return date.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // API 交互
    const loadFolderData = async (folderId = null) => {
        loading.value = true;
        selectedFiles.value = []; // 清空选择
        try {
            const authHeader = { 'Authorization': 'Basic ' + btoa('admin:123456') }; // TODO: useAuth

            if (folderId) {
                // 单个文件夹
                const res = await fetch(`/api/manage/folders/${folderId}`, { headers: authHeader }).then(r => r.json());
                if (res.success) {
                    currentFolder.value = res.data;
                    subfolders.value = res.data.subfolders;
                    files.value = res.data.files;
                    breadcrumbs.value = res.data.breadcrumbs || [];
                } else {
                    error(res.message);
                }
            } else {
                // 根目录
                const res = await fetch(`/api/manage/folders`, { headers: authHeader }).then(r => r.json());
                if (res.success) {
                    currentFolder.value = null;
                    subfolders.value = res.data;
                    files.value = []; // Root 不显示文件
                    breadcrumbs.value = [];
                } else {
                    error(res.message);
                }
            }
        } catch (e) {
            console.error(e);
            error('加载失败');
        } finally {
            loading.value = false;
        }
    };

    const createFolder = async (data) => {
        try {
            const payload = { ...data };
            if (!data.parentId && currentFolder.value) {
                payload.parentId = currentFolder.value.id;
            }

            const res = await fetch('/api/manage/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + btoa('admin:123456')
                },
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
            const res = await fetch(`/api/manage/folders/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + btoa('admin:123456')
                },
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
            const res = await fetch(`/api/manage/folders/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Basic ' + btoa('admin:123456') }
            }).then(r => r.json());

            if (res.success) {
                success('删除成功');
                // 如果删除的是当前文件夹，返回上一级
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
            const res = await fetch(`/api/manage/folders/${currentFolder.value.id}?file_id=${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Basic ' + btoa('admin:123456') }
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

    const uploadFiles = async (fileList) => {
        if (!currentFolder.value) {
            error('请先选择一个文件夹');
            return;
        }

        loading.value = true;
        let successCount = 0;

        for (const file of fileList) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch(`/api/manage/folders/${currentFolder.value.id}/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Basic ' + btoa('admin:123456') },
                    body: formData
                }).then(r => r.json());

                if (res.success) successCount++;
            } catch (e) {
                console.error(e);
            }
        }

        loading.value = false;
        if (successCount > 0) {
            success(`成功上传 ${successCount} 个文件`);
            loadFolderData(currentFolder.value.id);
        } else {
            error('上传失败');
        }
    };

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
        uploadFiles,

        isImage,
        getFileExtension,
        formatSize,
        formatDate
    };
}
