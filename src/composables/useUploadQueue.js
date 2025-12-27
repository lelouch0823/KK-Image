import { ref, computed, shallowRef } from 'vue';
import { useToast } from '@/composables/useToast';
import { API } from '@/utils/constants';

// ============================================================
// 全局状态 - 保证组件切换时队列不丢失
// ============================================================
const queue = ref([]);
const isUploading = ref(false);
const isMinimized = ref(false);
const concurrency = 3;
let activeUploads = 0;

// 用于通知特定文件夹刷新的回调 Map
// key = folderId, value = callback function
const folderRefreshCallbacks = shallowRef(new Map());

export function useUploadQueue() {
    const { addToast } = useToast();

    // 计算属性
    const hasItems = computed(() => queue.value.length > 0);

    const overallProgress = computed(() => {
        if (queue.value.length === 0) return 0;
        const totalProgress = queue.value.reduce((acc, item) => acc + item.progress, 0);
        return Math.floor(totalProgress / queue.value.length);
    });

    const activeCount = computed(() => queue.value.filter(item => item.status === 'uploading').length);
    const pendingCount = computed(() => queue.value.filter(item => item.status === 'pending').length);
    const completedCount = computed(() => queue.value.filter(item => item.status === 'success').length);

    // 🔧 NEW: 计算总速度 (所有正在上传文件的速度之和)
    const totalSpeed = computed(() => {
        return queue.value
            .filter(item => item.status === 'uploading' && item.speed > 0)
            .reduce((acc, item) => acc + item.speed, 0);
    });

    // 🔧 NEW: 计算预估剩余时间 (秒)
    const estimatedTimeRemaining = computed(() => {
        if (totalSpeed.value === 0) return null;
        const remainingBytes = queue.value
            .filter(item => item.status === 'uploading' || item.status === 'pending')
            .reduce((acc, item) => {
                const uploaded = item.size * (item.progress / 100);
                return acc + (item.size - uploaded);
            }, 0);
        return Math.ceil(remainingBytes / totalSpeed.value);
    });

    /**
     * 🔧 NEW: 注册文件夹刷新回调
     * @param {string} folderId
     * @param {Function} callback
     */
    const registerFolderRefresh = (folderId, callback) => {
        if (!folderId) return;
        const newMap = new Map(folderRefreshCallbacks.value);
        newMap.set(folderId, callback);
        folderRefreshCallbacks.value = newMap;
    };

    /**
     * 🔧 NEW: 注销文件夹刷新回调
     * @param {string} folderId
     */
    const unregisterFolderRefresh = (folderId) => {
        if (!folderId) return;
        const newMap = new Map(folderRefreshCallbacks.value);
        newMap.delete(folderId);
        folderRefreshCallbacks.value = newMap;
    };

    /**
     * 添加文件到上传队列
     */
    const addFiles = (files, folderId) => {
        if (!folderId) {
            addToast({ message: '请先选择上传目录', type: 'warning' });
            return;
        }

        const newItems = Array.from(files).map(file => ({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            file,
            name: file.name,
            size: file.size,
            folderId,
            progress: 0,
            status: 'pending',
            error: null,
            xhr: null,
            // 🔧 NEW: 速度追踪
            speed: 0,
            lastLoaded: 0,
            lastTime: 0
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

        const nextItem = queue.value.find(item => item.status === 'pending');
        if (!nextItem) {
            if (activeUploads === 0 && pendingCount.value === 0) {
                isUploading.value = false;
            }
            return;
        }

        activeUploads++;
        isUploading.value = true;
        uploadFile(nextItem);
    };

    /**
     * 上传单个文件
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

        // 🔧 IMPROVED: 进度监听 + 速度计算
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                item.progress = Math.round((e.loaded / e.total) * 100);

                // 计算速度 (bytes/second)
                const now = Date.now();
                const timeDiff = (now - item.lastTime) / 1000; // seconds
                if (timeDiff > 0.5) { // 每 500ms 更新一次速度
                    const bytesDiff = e.loaded - item.lastLoaded;
                    item.speed = Math.round(bytesDiff / timeDiff);
                    item.lastLoaded = e.loaded;
                    item.lastTime = now;
                }
            }
        };

        xhr.onload = () => {
            activeUploads--;
            item.speed = 0; // 上传完成，重置速度

            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const res = JSON.parse(xhr.responseText);
                    if (res.success) {
                        item.status = 'success';
                        item.progress = 100;

                        // 🔧 NEW: 触发该文件夹的刷新回调
                        const callback = folderRefreshCallbacks.value.get(item.folderId);
                        if (callback) {
                            callback();
                        }
                    } else {
                        item.status = 'error';
                        item.error = res.message || '上传失败';
                    }
                } catch (e) {
                    item.status = 'error';
                    item.error = '响应解析失败';
                }
            } else {
                item.status = 'error';
                item.error = `HTTP Error ${xhr.status}`;
            }
            processQueue();
        };

        xhr.onerror = () => {
            activeUploads--;
            item.status = 'error';
            item.error = '网络错误';
            item.speed = 0;
            processQueue();
        };

        const url = API.FOLDER_UPLOAD(item.folderId);
        xhr.open('POST', url, true);
        // 使用 cookies 认证 (通过 withCredentials)
        xhr.withCredentials = true;
        xhr.send(formData);

        processQueue();
    };

    /**
     * 移除/取消文件
     */
    const removeFile = (id) => {
        const index = queue.value.findIndex(item => item.id === id);
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
     * 🔧 NEW: 重试失败的文件
     */
    const retryFile = (id) => {
        const item = queue.value.find(item => item.id === id);
        if (item && item.status === 'error') {
            item.status = 'pending';
            item.progress = 0;
            item.error = null;
            item.speed = 0;
            processQueue();
        }
    };

    /**
     * 🔧 NEW: 重试所有失败的文件
     */
    const retryAllFailed = () => {
        queue.value
            .filter(item => item.status === 'error')
            .forEach(item => {
                item.status = 'pending';
                item.progress = 0;
                item.error = null;
                item.speed = 0;
            });
        processQueue();
    };

    /**
     * 清除已完成的项目
     */
    const clearCompleted = () => {
        queue.value = queue.value.filter(item => item.status !== 'success');
    };

    /**
     * 清空整个队列
     */
    const clearAll = () => {
        queue.value.forEach(item => {
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
        isMinimized, // 🔧 FIX: 现在是全局共享的
        overallProgress,
        hasItems,
        activeCount,
        pendingCount,
        completedCount,
        totalSpeed,              // 🔧 NEW
        estimatedTimeRemaining,  // 🔧 NEW

        addFiles,
        removeFile,
        retryFile,           // 🔧 NEW
        retryAllFailed,      // 🔧 NEW
        clearCompleted,
        clearAll,
        registerFolderRefresh,   // 🔧 NEW
        unregisterFolderRefresh  // 🔧 NEW
    };
}
