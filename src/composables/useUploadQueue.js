
import { ref, computed } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';

// 全局状态 - 保证组件切换时队列不丢失
const queue = ref([]);
const isUploading = ref(false);
const concurrency = 3; // 最大并发数
let activeUploads = 0;

export function useUploadQueue() {
    const { addToast } = useToast();
    const { getAuthHeader } = useAuth();
    const isMinimized = ref(false);

    // 计算属性
    const hasItems = computed(() => queue.value.length > 0);

    // 总体进度
    const overallProgress = computed(() => {
        if (queue.value.length === 0) return 0;
        const totalProgress = queue.value.reduce((acc, item) => acc + item.progress, 0);
        return Math.floor(totalProgress / queue.value.length);
    });

    const activeCount = computed(() => queue.value.filter(item => item.status === 'uploading').length);
    const pendingCount = computed(() => queue.value.filter(item => item.status === 'pending').length);
    const completedCount = computed(() => queue.value.filter(item => item.status === 'success').length);

    /**
     * 添加文件到上传队列
     * @param {Array<File>} files - File 对象数组
     * @param {string} folderId - 目标文件夹ID
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
            status: 'pending', // pending, uploading, success, error
            error: null,
            xhr: null // 用于取消请求
        }));

        queue.value.push(...newItems);

        // 如果面板被最小化了，有新文件时自动展开
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

        // 获取下一个等待中的文件
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
     * 上传单个文件 (使用 XMLHttpRequest 以获取进度)
     */
    const uploadFile = (item) => {
        item.status = 'uploading';
        item.progress = 0;

        const formData = new FormData();
        formData.append('file', item.file);

        const xhr = new XMLHttpRequest();
        item.xhr = xhr;

        // 进度监听
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                item.progress = Math.round((e.loaded / e.total) * 100);
            }
        };

        xhr.onload = () => {
            activeUploads--;
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const res = JSON.parse(xhr.responseText);
                    if (res.success) {
                        item.status = 'success';
                        item.progress = 100;
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
            processQueue(); // 触发下一个
        };

        xhr.onerror = () => {
            activeUploads--;
            item.status = 'error';
            item.error = '网络错误';
            processQueue();
        };

        // 获取 Auth Header 并设置
        const authHeader = getAuthHeader(); // 返回 { Authorization: '...' } 或 {}

        // 这里需要手动构建 API URL
        // 使用相对路径，假设 API Base URL 是当前域
        const url = API.FOLDER_UPLOAD(item.folderId);

        xhr.open('POST', url, true);

        // 设置 Headers
        if (authHeader.Authorization) {
            xhr.setRequestHeader('Authorization', authHeader.Authorization);
        }

        // XMLHttpRequest 默认不带 Credentials (Cookie)，如果需要 Cookie 认证需要设置
        // 我们的 useAuth 中显示 'credentials: include'，所以这里也应该设置
        xhr.withCredentials = true;

        xhr.send(formData);

        // 尝试并发处理下一个（如果有空槽）
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
                item.xhr.abort(); // 取消请求
                activeUploads--;
            }
            queue.value.splice(index, 1);
            processQueue();
        }
    };

    /**
     * 清除已完成的项目
     */
    const clearCompleted = () => {
        queue.value = queue.value.filter(item => item.status !== 'success');
    };

    /**
     * 清空整个队列 (也会取消正在进行的上传)
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
        isUploading, // 是否有任务在进行
        isMinimized, // 是否最小化UI
        overallProgress,
        hasItems,
        activeCount,
        pendingCount,
        completedCount,

        addFiles,
        removeFile,
        clearCompleted,
        clearAll
    };
}
