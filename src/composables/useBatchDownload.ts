/**
 * 批量下载 Composable
 * @module composables/useBatchDownload
 *
 * 客户端打包下载多个文件为 ZIP
 */
import { ref, type Ref } from 'vue';
import JSZip from 'jszip';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

interface DownloadFile {
  url: string;
  name: string;
}

export function useBatchDownload() {
  const { addToast } = useToast();
  const { t } = useI18n();

  const downloading: Ref<boolean> = ref(false);
  const downloadProgress: Ref<number> = ref(0);

  /**
   * 批量下载文件并打包为 ZIP
   * @param files - 文件列表
   * @param zipName - ZIP 文件名（不含扩展名）
   */
  const downloadAll = async (files: DownloadFile[], zipName = 'download'): Promise<void> => {
    if (downloading.value || !files?.length) return;

    downloading.value = true;
    downloadProgress.value = 0;

    try {
      const zip = new JSZip();
      let completed = 0;
      let successfulDownloads = 0;

      // 并行下载所有文件
      const promises = files.map(async (file) => {
        try {
          const response = await fetch(file.url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status || 0}`);
          }
          const blob = await response.blob();
          zip.file(file.name, blob);
          successfulDownloads++;

          completed++;
          downloadProgress.value = Math.floor((completed / files.length) * 50);
        } catch (_e) {
          console.error('Download failed for', file.name, _e);
        }
      });

      await Promise.all(promises);
      if (successfulDownloads === 0) {
        throw new Error('No downloadable files');
      }

      // 生成 ZIP
      const content = await zip.generateAsync({
        type: 'blob',
        onUpdate: (metadata: { percent: number }) => {
          downloadProgress.value = 50 + Math.floor(metadata.percent / 2);
        },
      } as any);

      // 触发下载
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${zipName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({ message: t('batchDownload.started'), type: 'success' });
    } catch (_e) {
      addToast({ message: t('batchDownload.failed'), type: 'error' });
    } finally {
      downloading.value = false;
      downloadProgress.value = 0;
    }
  };

  return {
    downloading,
    downloadProgress,
    downloadAll,
  };
}
