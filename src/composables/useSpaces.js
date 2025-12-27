/**
 * 空间管理 Composable
 * @module composables/useSpaces
 */
import { ref } from 'vue';
import { API } from '@/utils/constants';
import { useToast } from '@/composables/useToast';

// 全局状态
const spaces = ref([]);
const currentSpace = ref(null);
const loading = ref(false);

export function useSpaces() {
    const { addToast } = useToast();

    /**
     * 加载空间列表
     */
    const loadSpaces = async (parentId = null) => {
        loading.value = true;
        try {
            const url = parentId ? `${API.SPACES}?parent_id=${parentId}` : API.SPACES;
            const response = await fetch(url, { credentials: 'include' });
            const result = await response.json();

            if (result.success) {
                spaces.value = result.data;
            } else {
                addToast({ message: result.message || '加载失败', type: 'error' });
            }
        } catch (err) {
            console.error('加载空间列表失败:', err);
            addToast({ message: '网络错误', type: 'error' });
        } finally {
            loading.value = false;
        }
    };

    /**
     * 获取空间详情
     */
    const loadSpace = async (spaceId) => {
        loading.value = true;
        try {
            const response = await fetch(API.SPACE_BY_ID(spaceId), { credentials: 'include' });
            const result = await response.json();

            if (result.success) {
                currentSpace.value = result.data;
                return result.data;
            } else {
                addToast({ message: result.message || '加载失败', type: 'error' });
                return null;
            }
        } catch (err) {
            console.error('加载空间详情失败:', err);
            addToast({ message: '网络错误', type: 'error' });
            return null;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 创建空间
     */
    const createSpace = async (data) => {
        try {
            const response = await fetch(API.SPACES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                addToast({ message: '空间创建成功', type: 'success' });
                await loadSpaces();
                return result.data;
            } else {
                addToast({ message: result.message || '创建失败', type: 'error' });
                return null;
            }
        } catch (err) {
            console.error('创建空间失败:', err);
            addToast({ message: '网络错误', type: 'error' });
            return null;
        }
    };

    /**
     * 更新空间
     */
    const updateSpace = async (spaceId, data) => {
        try {
            const response = await fetch(API.SPACE_BY_ID(spaceId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                addToast({ message: '空间已更新', type: 'success' });
                await loadSpaces();
                return result.data;
            } else {
                addToast({ message: result.message || '更新失败', type: 'error' });
                return null;
            }
        } catch (err) {
            console.error('更新空间失败:', err);
            addToast({ message: '网络错误', type: 'error' });
            return null;
        }
    };

    /**
     * 删除空间
     */
    const deleteSpace = async (spaceId) => {
        try {
            const response = await fetch(API.SPACE_BY_ID(spaceId), {
                method: 'DELETE',
                credentials: 'include'
            });
            const result = await response.json();

            if (result.success) {
                addToast({ message: '空间已删除', type: 'success' });
                await loadSpaces();
                return true;
            } else {
                addToast({ message: result.message || '删除失败', type: 'error' });
                return false;
            }
        } catch (err) {
            console.error('删除空间失败:', err);
            addToast({ message: '网络错误', type: 'error' });
            return false;
        }
    };

    /**
     * 添加文件到空间
     */
    const addFilesToSpace = async (spaceId, fileIds, section = 'default') => {
        try {
            const body = Array.isArray(fileIds)
                ? { fileIds, section }
                : { ...fileIds, section }; // 支持传对象 { fileIds, folderIds }

            const response = await fetch(API.SPACE_FILES(spaceId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });
            const result = await response.json();

            if (result.success) {
                addToast({ message: result.data.message, type: 'success' });
                return true;
            } else {
                addToast({ message: result.message || '添加失败', type: 'error' });
                return false;
            }
        } catch (err) {
            console.error('添加文件失败:', err);
            addToast({ message: '网络错误', type: 'error' });
            return false;
        }
    };

    /**
     * 从空间移除文件
     */
    const removeFilesFromSpace = async (spaceId, fileIds) => {
        try {
            const response = await fetch(API.SPACE_FILES(spaceId), {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ fileIds })
            });
            const result = await response.json();

            if (result.success) {
                addToast({ message: '文件已移除', type: 'success' });
                return true;
            } else {
                addToast({ message: result.message || '移除失败', type: 'error' });
                return false;
            }
        } catch (err) {
            console.error('移除文件失败:', err);
            addToast({ message: '网络错误', type: 'error' });
            return false;
        }
    };

    return {
        spaces,
        currentSpace,
        loading,
        loadSpaces,
        loadSpace,
        createSpace,
        updateSpace,
        deleteSpace,
        addFilesToSpace,
        removeFilesFromSpace
    };
}
