import { ref, computed, shallowRef } from 'vue';
import { generateRandomId } from '@/utils/common';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useRequestAdapters } from '@/composables/useRequestAdapters';
import { useImageCompression } from '@/composables/useImageCompression';
import { API, MAX_UPLOAD_SIZE } from '@/utils/constants';
import { parseJsonObject } from '@/utils/json.js';

// ============================================================
// 全局状态 - 保证组件切换时队列不丢失
// ============================================================
const queue = ref([]);
const isUploading = ref(false);
const isMinimized = ref(false);
const concurrency = 3;
let activeUploads = 0;

// 用于通知特定文件夹刷新的回调 Map
const folderRefreshCallbacks = shallowRef(new Map());

export function useUploadQueue() {
  const { addToast } = useToast();
  const { t } = useI18n();
  const { requestAuth } = useRequestAdapters();

  // 计算属性
  const hasItems = computed(() => queue.value.length > 0);

  const overallProgress = computed(() => {
    if (queue.value.length === 0) return 0;
    const totalProgress = queue.value.reduce((acc, item) => acc + item.progress, 0);
    return Math.floor(totalProgress / queue.value.length);
  });

  const activeCount = computed(
    () => queue.value.filter((item) => item.status === 'uploading').length
  );
  const pendingCount = computed(
    () => queue.value.filter((item) => item.status === 'pending').length
  );
  const completedCount = computed(
    () => queue.value.filter((item) => item.status === 'success').length
  );

  // 总速度 (所有正在上传文件的速度之和)
  const totalSpeed = computed(() => {
    return queue.value
      .filter((item) => item.status === 'uploading' && item.speed > 0)
      .reduce((acc, item) => acc + item.speed, 0);
  });

  // 预估剩余时间 (秒)
  const estimatedTimeRemaining = computed(() => {
    if (totalSpeed.value === 0) return null;
    const remainingBytes = queue.value
      .filter((item) => item.status === 'uploading' || item.status === 'pending')
      .reduce((acc, item) => {
        const uploaded = item.size * (item.progress / 100);
        return acc + (item.size - uploaded);
      }, 0);
    return Math.ceil(remainingBytes / totalSpeed.value);
  });

  /**
   * 注册文件夹刷新回调
   */
  const registerFolderRefresh = (folderId, callback) => {
    if (!folderId) return;
    const newMap = new Map(folderRefreshCallbacks.value);
    newMap.set(folderId, callback);
    folderRefreshCallbacks.value = newMap;
  };

  /**
   * 注销文件夹刷新回调
   */
  const unregisterFolderRefresh = (folderId) => {
    if (!folderId) return;
    const newMap = new Map(folderRefreshCallbacks.value);
    newMap.delete(folderId);
    folderRefreshCallbacks.value = newMap;
  };

  /**
   * 添加文件到上传队列
   * @param {FileList|Array<File>} files 文件列表
   * @param {string} folderId 目标文件夹ID (如果是 root 可以传 'root'，若是直接传到 space 可忽略，只要 options 提供了 spaceId)
   * @param {Object} [options] 额外参数，例如 { spaceId: '123' }
   */
  const addFiles = (files, folderId, options = {}) => {
    if (!folderId && !options.spaceId) {
      addToast({ message: t('uploadQueue.selectFolderFirst'), type: 'warning' });
      return;
    }

    const validFiles = [];
    const invalidFiles = [];

    Array.from(files).forEach((file) => {
      if (file.size > MAX_UPLOAD_SIZE) {
        invalidFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    if (invalidFiles.length > 0) {
      addToast({
        message:
          t('uploadQueue.fileTooLarge', { count: invalidFiles.length }) +
          `: ${invalidFiles.slice(0, 2).join(', ')}${invalidFiles.length > 2 ? '...' : ''} `,
        type: 'error',
        duration: 5000,
      });
    }

    if (validFiles.length === 0) return;

    const newItems = validFiles.map((file) => ({
      id: generateRandomId('upload'),
      file,
      name: file.name,
      size: file.size,
      folderId,
      progress: 0,
      status: 'pending',  // pending → hashing → uploading → success/error
      error: null,
      xhr: null,
      // 速度追踪
      speed: 0,
      lastLoaded: 0,
      lastTime: 0,
      // 哈希
      hash: null,
      // 额外参数
      options,
    }));

    queue.value.push(...newItems);

    if (isMinimized.value) {
      isMinimized.value = false;
    }

    processQueue();
  };

  /**
   * 处理上传队列 (调度器)
   */
  const processQueue = () => {
    if (activeUploads >= concurrency) return;

    const nextItem = queue.value.find((item) => item.status === 'pending');
    if (!nextItem) {
      if (activeUploads === 0 && pendingCount.value === 0) {
        isUploading.value = false;
      }
      return;
    }

    activeUploads++;
    isUploading.value = true;
    handleUpload(nextItem);
  };

  // ============================================================
  // SOTA: 哈希计算 + 秒传预检
  // ============================================================

  /**
   * 使用 Web Crypto API 计算 SHA-256
   * @param {File} file
   * @returns {Promise<string>} 十六进制哈希
   */
  async function computeHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 检查哈希是否已存在（秒传预检）
   * @param {string} hash
   * @returns {Promise<Object|null>} 已存在的文件信息或 null
   */
  async function checkHash(hash) {
    try {
      const res = await requestAuth(API.CHECK_HASH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_hash: hash }),
      });
      const data = await res.json();
      if (data.success && data.data?.exists) {
        return data.data.file;
      }
    } catch (_e) {
      // 预检失败不阻塞上传
    }
    return null;
  }

  /**
   * 完整上传流程：压缩/水印 → 哈希 → 预检 → 上传
   */
  async function handleUpload(item) {
    let finalFile = item.file;
    let finalHash = null;

    // ── 阶段 0: 尝试压缩和水印 (仅限图片) ──
    if (finalFile.type.startsWith('image/') && finalFile.type !== 'image/gif') {
      item.status = 'compressing';
      try {
        const { compressImage } = useImageCompression();

        // compressImage 内部包含了 drawWatermark 的逻辑
        const result = await compressImage(finalFile, (progress) => {
          item.progress = progress; // Show compression progress
        });

        finalFile = result.file;
        finalHash = result.hash;
        // Optionally store original hash for cross-device deduplication if needed
        item.originalHash = result.originalHash;
      } catch (e) {
        console.warn('Compression or watermark failed, falling back to original file', e);
      }
    }

    // 更新 item 以使用新文件
    item.file = finalFile;
    item.size = finalFile.size;
    item.progress = 0; // 重置进度供后续使用

    // ── 阶段 1: 哈希计算 (文件 < 50MB) ──
    if (item.size < 50 * 1024 * 1024) {
      item.status = 'hashing';
      try {
        // 如果前面压缩时已经计算过 hash，可以直接复用
        item.hash = finalHash || await computeHash(item.file);

        // ── 阶段 2: 秒传预检 ──
        // 对于带水印的图片，这里预检的是 (带水印后的文件哈希)，
        // 这意味着同一个水印配置下重复上传同一张图能够秒传，但我们也可以传 original_hash 作为备用。
        // SOTA: 这里简化逻辑，直接预检 finalHash，确保如果图片改动(加水印)能被正确存储。
        let checkHashStr = item.originalHash || item.hash; // 优先使用原始高质图的hash去预检
        const existing = await checkHash(checkHashStr);
        if (existing) {
          // 秒传成功！
          item.status = 'success';
          item.progress = 100;
          activeUploads--;

          addToast({
            message: `${item.name} ${t('uploadQueue.instantUpload')}`,
            type: 'success',
            duration: 2000,
          });

          // 触发文件夹刷新
          const callback = folderRefreshCallbacks.value.get(item.folderId);
          if (callback) callback();

          processQueue();
          return;
        }
      } catch (_e) {
        // 哈希失败不阻塞，继续正常上传
        if (!item.hash) item.hash = null;
      }
    }

    // ── 阶段 3: 实际上传 ──
    uploadFile(item);
  }

  /**
   * 上传单个文件 (XHR)
   */
  const uploadFile = (item) => {
    item.status = 'uploading';
    item.progress = 0;
    item.lastLoaded = 0;
    item.lastTime = Date.now();

    const formData = new FormData();
    formData.append('file', item.file);

    const xhr = new XMLHttpRequest();
    item.xhr = xhr;

    // 进度监听 + 速度计算
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        item.progress = Math.round((e.loaded / e.total) * 100);

        const now = Date.now();
        const timeDiff = (now - item.lastTime) / 1000;
        if (timeDiff > 0.5) {
          const bytesDiff = e.loaded - item.lastLoaded;
          item.speed = Math.round(bytesDiff / timeDiff);
          item.lastLoaded = e.loaded;
          item.lastTime = now;
        }
      }
    };

    xhr.onload = () => {
      activeUploads--;
      item.speed = 0;

      if (xhr.status >= 200 && xhr.status < 300) {
        const res = parseJsonObject(xhr.responseText, null);
        if (!res) {
          item.status = 'error';
          item.error = t('uploadQueue.parseError');
        } else if (res.success) {
          item.status = 'success';
          item.progress = 100;

          // 触发该文件夹的刷新回调
          const callback = folderRefreshCallbacks.value.get(item.folderId);
          if (callback) {
            callback();
          }
        } else {
          item.status = 'error';
          item.error = res.message || t('uploadQueue.uploadFailed');
        }
      } else {
        item.status = 'error';
        item.error = `HTTP Error ${xhr.status} `;
      }
      processQueue();
    };

    xhr.onerror = () => {
      activeUploads--;
      item.status = 'error';
      item.error = t('uploadQueue.networkError');
      item.speed = 0;
      processQueue();
    };

    // 构建上传 URL
    let url = API.FOLDER_UPLOAD(item.folderId || 'root'); // Default to root if missing but we have spaceId

    // 如果有额外参数 (如 spaceId)，我们可以直接覆写为 MANAGE_UPLOAD (基础上传接口)
    if (item.options?.spaceId) {
      url = API.MANAGE_UPLOAD;
    }

    const params = new URLSearchParams();
    if (item.hash) {
      params.set('contentHash', item.hash);
      // originalHash 包含用户指定的未打水印大图源的Hash，用于服务端真正的判重
      params.set('originalHash', item.originalHash || item.hash);
    }

    // 注入额外参数
    if (item.options) {
      Object.keys(item.options).forEach(k => {
        if (item.options[k]) {
          params.set(k, item.options[k]);
        }
      });
    }

    const queryStr = params.toString();
    if (queryStr) {
      url += `?${queryStr}`;
    }

    xhr.open('POST', url, true);
    xhr.withCredentials = true;
    xhr.send(formData);

    processQueue();
  };

  /**
   * 移除/取消文件
   */
  const removeFile = (id) => {
    const index = queue.value.findIndex((item) => item.id === id);
    if (index !== -1) {
      const item = queue.value[index];
      if (item.status === 'uploading' && item.xhr) {
        item.xhr.abort();
        activeUploads--;
      }
      queue.value.splice(index, 1);
      processQueue();
    }
  };

  /**
   * 重试失败的文件
   */
  const retryFile = (id) => {
    const item = queue.value.find((item) => item.id === id);
    if (item && item.status === 'error') {
      item.status = 'pending';
      item.progress = 0;
      item.error = null;
      item.speed = 0;
      item.hash = null;
      processQueue();
    }
  };

  /**
   * 重试所有失败的文件
   */
  const retryAllFailed = () => {
    queue.value
      .filter((item) => item.status === 'error')
      .forEach((item) => {
        item.status = 'pending';
        item.progress = 0;
        item.error = null;
        item.speed = 0;
        item.hash = null;
      });
    processQueue();
  };

  /**
   * 清除已完成的项目
   */
  const clearCompleted = () => {
    queue.value = queue.value.filter((item) => item.status !== 'success');
  };

  /**
   * 清空整个队列
   */
  const clearAll = () => {
    queue.value.forEach((item) => {
      if (item.status === 'uploading' && item.xhr) {
        item.xhr.abort();
      }
    });
    activeUploads = 0;
    queue.value = [];
    isUploading.value = false;
  };

  return {
    queue,
    isUploading,
    isMinimized,
    overallProgress,
    hasItems,
    activeCount,
    pendingCount,
    completedCount,
    totalSpeed,
    estimatedTimeRemaining,

    addFiles,
    removeFile,
    retryFile,
    retryAllFailed,
    clearCompleted,
    clearAll,
    registerFolderRefresh,
    unregisterFolderRefresh,
  };
}
