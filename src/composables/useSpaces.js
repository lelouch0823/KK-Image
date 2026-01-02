/**
 * 空间管理 Composable
 * @module composables/useSpaces
 */
import { ref } from 'vue';
import { API } from '@/utils/constants';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

// 全局状态
const spaces = ref([]);
const currentSpace = ref(null);
const loading = ref(false);

export function useSpaces() {
  const { addToast } = useToast();
  const { t } = useI18n();

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
        addToast({ message: result.message || t('spaces.loadFailed'), type: 'error' });
      }
    } catch (err) {
      console.error(t('spaces.loadFailed'), err);
      addToast({ message: t('spaces.networkError'), type: 'error' });
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
        addToast({ message: result.message || t('spaces.loadFailed'), type: 'error' });
        return null;
      }
    } catch (err) {
      console.error(t('spaces.loadDetailFailed'), err);
      addToast({ message: t('spaces.networkError'), type: 'error' });
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
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (result.success) {
        addToast({ message: t('spaces.createSuccess'), type: 'success' });
        await loadSpaces();
        return result.data;
      } else {
        addToast({ message: result.message || t('spaces.createFailed'), type: 'error' });
        return null;
      }
    } catch (err) {
      console.error(t('spaces.createFailed'), err);
      addToast({ message: t('spaces.networkError'), type: 'error' });
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
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (result.success) {
        addToast({ message: t('spaces.updateSuccess'), type: 'success' });
        await loadSpaces();
        return result.data;
      } else {
        addToast({ message: result.message || t('spaces.updateFailed'), type: 'error' });
        return null;
      }
    } catch (err) {
      console.error(t('spaces.updateFailed'), err);
      addToast({ message: t('spaces.networkError'), type: 'error' });
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
        credentials: 'include',
      });
      const result = await response.json();

      if (result.success) {
        addToast({ message: t('spaces.deleteSuccess'), type: 'success' });
        await loadSpaces();
        return true;
      } else {
        addToast({ message: result.message || t('spaces.deleteFailed'), type: 'error' });
        return false;
      }
    } catch (err) {
      console.error(t('spaces.deleteFailed'), err);
      addToast({ message: t('spaces.networkError'), type: 'error' });
      return false;
    }
  };

  /**
   * 添加文件到空间
   */
  const addFilesToSpace = async (spaceId, fileIds, section = 'default') => {
    try {
      const body = Array.isArray(fileIds) ? { fileIds, section } : { ...fileIds, section }; // 支持传对象 { fileIds, folderIds }

      const response = await fetch(API.SPACE_FILES(spaceId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (result.success) {
        addToast({ message: result.message || t('spaces.addFileSuccess'), type: 'success' });
        return true;
      } else {
        addToast({ message: result.message || t('spaces.addFileFailed'), type: 'error' });
        return false;
      }
    } catch (err) {
      console.error(t('spaces.addFileFailed'), err);
      addToast({ message: t('spaces.networkError'), type: 'error' });
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
        body: JSON.stringify({ fileIds }),
      });
      const result = await response.json();

      if (result.success) {
        addToast({ message: t('spaces.removeFileSuccess'), type: 'success' });
        return true;
      } else {
        addToast({ message: result.message || t('spaces.removeFileFailed'), type: 'error' });
        return false;
      }
    } catch (err) {
      console.error(t('spaces.removeFileFailed'), err);
      addToast({ message: t('spaces.networkError'), type: 'error' });
      return false;
    }
  };

  /**
   * 加载子空间列表
   */
  const loadSubspaces = async (parentId) => {
    try {
      const response = await fetch(API.SPACE_SUBSPACES(parentId), { credentials: 'include' });
      const result = await response.json();
      if (result.success) {
        return result.data;
      } else {
        addToast({ message: result.message || t('spaces.loadFailed'), type: 'error' });
        return [];
      }
    } catch (err) {
      console.error(t('spaces.loadFailed'), err);
      addToast({ message: t('spaces.networkError'), type: 'error' });
      return [];
    }
  };

  /**
   * 创建子空间
   */
  const createSubspace = async (parentId, data) => {
    try {
      const response = await fetch(API.SPACE_SUBSPACES(parentId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (result.success) {
        addToast({ message: t('spaces.createSuccess'), type: 'success' });
        return result.data;
      } else {
        addToast({ message: result.message || t('spaces.createFailed'), type: 'error' });
        return null;
      }
    } catch (err) {
      console.error(t('spaces.createFailed'), err);
      addToast({ message: t('spaces.networkError'), type: 'error' });
      return null;
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
    removeFilesFromSpace,
    loadSubspaces,
    createSubspace,
  };
}
