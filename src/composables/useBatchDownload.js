/**
 * 批量下载 Composable
 * @module composables/useBatchDownload
 * 
 * 客户端打包下载多个文件为 ZIP
 */
import { ref } from 'vue';
import JSZip from 'jszip';
import { useToast } from '@/composables/useToast';

export function useBatchDownload() {
    const { addToast } = useToast();

    const downloading = ref(false);
    const downloadProgress = ref(0);

    /**
     * 批量下载文件并打包为 ZIP
     * @param {Array<{url: string, name: string}>} files - 文件列表
     * @param {string} zipName - ZIP 文件名（不含扩展名）
     */
    const downloadAll = async (files, zipName = 'download') => {
        if (downloading.value || !files?.length) return;

        downloading.value = true;
        downloadProgress.value = 0;

        try {
            const zip = new JSZip();
            let completed = 0;

            // 并行下载所有文件
            const promises = files.map(async (file) => {
                try {
                    const response = await fetch(file.url);
                    const blob = await response.blob();
                    zip.file(file.name, blob);

                    completed++;
                    downloadProgress.value = Math.floor((completed / files.length) * 50);
                } catch (e) {
                    console.error('Download failed for', file.name, e);
                }
            });

            await Promise.all(promises);

            // 生成 ZIP
            const content = await zip.generateAsync({
                type: 'blob',
                onUpdate: (metadata) => {
                    downloadProgress.value = 50 + Math.floor(metadata.percent / 2);
                }
            });

            // 触发下载
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${zipName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            addToast({ message: '下载已开始', type: 'success' });

        } catch (e) {
            addToast({ message: '打包下载失败', type: 'error' });
        } finally {
            downloading.value = false;
            downloadProgress.value = 0;
        }
    };

    return {
        downloading,
        downloadProgress,
        downloadAll
    };
}
