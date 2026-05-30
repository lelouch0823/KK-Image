/**
 * 空间管理 Composable
 * @module composables/useSpaces
 */
import { ref } from 'vue';
import { useResource } from './useResource';
import { API } from '@/utils/constants';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { handleApiError } from '@/utils/api-helpers';

// 全局状态：当前空间详情
const currentSpace = ref(null);

export function useSpaces() {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const { t } = useI18n();

  // 使用 useResource 管理空间列表的基础 CRUD
  const resource = useResource(API.SPACES);

  /**
   * 加载空间列表（支持父级过滤）
   */
  const loadSpaces = async (parentId = null) => {
    const params = parentId ? { parent_id: parentId } : {};
    return resource.loadItems(params);
  };

  /**
   * 按商品加载关联空间列表
   */
  const loadProductSpaces = async (productId) => {
    const res = await authFetch(API.SPACE_BY_PRODUCT(productId)).then(r => r.json());
    if (res.success) {
      return res.data;
    }
    throw new Error(res.error || res.message || t('spaces.loadFailed'));
  };

  /**
   * 获取空间详情
   */
  const loadSpace = async (spaceId) => {
    try {
      const res = await authFetch(API.SPACE_BY_ID(spaceId)).then(r => r.json());

      if (res.success) {
        currentSpace.value = res.data;
        return res.data;
      } else {
        addToast({ message: res.message || t('spaces.loadFailed'), type: 'error' });
        return null;
      }
    } catch (_err) {
      handleApiError(_err, { t, addToast, fallbackKey: 'spaces.networkError' });
      return null;
    }
  };

  /**
   * 添加文件到空间
   */
  const addFilesToSpace = async (spaceId, fileIds, section = 'default') => {
    try {
      const body = Array.isArray(fileIds) ? { fileIds, section } : { ...fileIds, section }; // 支持传对象 { fileIds, folderIds }

      const res = await authFetch(API.SPACE_FILES(spaceId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json());

      if (res.success) {
        addToast({ message: res.message || t('spaces.addFileSuccess'), type: 'success' });
        return true;
      } else {
        addToast({ message: res.message || t('spaces.addFileFailed'), type: 'error' });
        return false;
      }
    } catch (_err) {
      handleApiError(_err, { t, addToast, fallbackKey: 'spaces.networkError' });
      return false;
    }
  };

  /**
   * 从空间移除文件
   */
  const removeFilesFromSpace = async (spaceId, fileIds) => {
    try {
      const res = await authFetch(API.SPACE_FILES(spaceId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds }),
      }).then(r => r.json());

      if (res.success) {
        addToast({ message: t('spaces.removeFileSuccess'), type: 'success' });
        return true;
      } else {
        addToast({ message: res.message || t('spaces.removeFileFailed'), type: 'error' });
        return false;
      }
    } catch (_err) {
      handleApiError(_err, { t, addToast, fallbackKey: 'spaces.networkError' });
      return false;
    }
  };

  /**
   * 重新排序空间文件
   * @param {string} spaceId
   * @param {Array<string>} fileIds - Sorted list of file IDs
   */
  const reorderSpaceFiles = async (spaceId, fileIds) => {
    try {
      const res = await authFetch(API.SPACE_FILES(spaceId) + '/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds }),
      }).then(r => r.json());

      if (res.success) {
        return true;
      } else {
        addToast({ message: res.message || t('spaces.reorderFailed'), type: 'error' });
        return false;
      }
    } catch (_err) {
      handleApiError(_err, { t, addToast, fallbackKey: 'spaces.networkError' });
      return false;
    }
  };

  /**
   * 加载子空间列表
   */
  const loadSubspaces = async (parentId) => {
    try {
      const res = await authFetch(API.SPACE_SUBSPACES(parentId)).then(r => r.json());

      if (res.success) {
        return res.data;
      } else {
        addToast({ message: res.message || t('spaces.loadFailed'), type: 'error' });
        return [];
      }
    } catch (_err) {
      handleApiError(_err, { t, addToast, fallbackKey: 'spaces.networkError' });
      return [];
    }
  };

  /**
   * 创建子空间
   */
  const createSubspace = async (parentId, data) => {
    try {
      const res = await authFetch(API.SPACE_SUBSPACES(parentId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json());

      if (res.success) {
        addToast({ message: t('spaces.createSuccess'), type: 'success' });
        return res.data;
      } else {
        addToast({ message: res.message || t('spaces.createFailed'), type: 'error' });
        return null;
      }
    } catch (_err) {
      handleApiError(_err, { t, addToast, fallbackKey: 'spaces.networkError' });
      return null;
    }
  };

  return {
    spaces: resource.items,
    currentSpace,
    loading: resource.loading,
    error: resource.error,
    errorCode: resource.errorCode,
    pagination: resource.pagination,
    loadSpaces,
    loadProductSpaces,
    loadSpace,
    createSpace: resource.createItem,
    updateSpace: resource.updateItem,
    deleteSpace: resource.deleteItem,
    addFilesToSpace,
    removeFilesFromSpace,
    reorderSpaceFiles,
    loadSubspaces,
    createSubspace,
  };
}
