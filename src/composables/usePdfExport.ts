/**
 * PDF 导出 Composable
 * 基于 html2pdf.js（已在项目依赖中）
 * @module composables/usePdfExport
 */
import { ref, type Ref } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

export interface PdfExportOptions {
  /** 文件名（不含 .pdf 后缀） */
  filename: string;
  /** 页面边距 [上, 右, 下, 左] mm */
  margin?: [number, number, number, number];
  /** 纸张格式 */
  format?: 'a4' | 'a5' | 'letter';
  /** 页面方向 */
  orientation?: 'portrait' | 'landscape';
  /** 图片质量 0-1 */
  imageQuality?: number;
  /** html2canvas 缩放比例 */
  scale?: number;
}

const DEFAULT_OPTIONS: Omit<PdfExportOptions, 'filename'> = {
  margin: [10, 10, 10, 10],
  format: 'a4',
  orientation: 'portrait',
  imageQuality: 0.98,
  scale: 2,
};

export function usePdfExport() {
  const { addToast } = useToast();
  const { t } = useI18n();
  const isExporting: Ref<boolean> = ref(false);

  /**
   * 导出 DOM 元素为 PDF
   * @param element - 要导出的 DOM 元素
   * @param options - PDF 导出选项
   */
  const exportToPdf = async (element: HTMLElement, options: PdfExportOptions): Promise<void> => {
    if (!element || isExporting.value) return;

    isExporting.value = true;

    try {
      // 克隆元素使其在屏幕外可见
      const clone = element.cloneNode(true) as HTMLElement;
      clone.classList.remove('hidden');
      clone.style.display = 'block';
      clone.style.position = 'absolute';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.width = '210mm';
      clone.style.background = 'white';

      document.body.appendChild(clone);

      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

      const html2pdf = (await import('html2pdf.js')).default;

      await html2pdf()
        .set({
          margin: mergedOptions.margin,
          filename: `${mergedOptions.filename}.pdf`,
          image: { type: 'jpeg', quality: mergedOptions.imageQuality },
          html2canvas: { scale: mergedOptions.scale, useCORS: true, logging: false },
          jsPDF: {
            unit: 'mm',
            format: mergedOptions.format,
            orientation: mergedOptions.orientation,
          },
        })
        .from(clone)
        .save();

      if (clone.parentNode) {
        document.body.removeChild(clone);
      }

      addToast({
        message: t('print.pdfExportSuccess', 'PDF 导出成功'),
        type: 'success',
      });
    } catch (err) {
      console.error('[PDF] 导出失败:', err);
      addToast({
        message: t('print.pdfExportFailed', 'PDF 导出失败'),
        type: 'error',
      });
    } finally {
      isExporting.value = false;
    }
  };

  /**
   * 规范化文件名，移除特殊字符
   */
  const sanitizeFilename = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9一-龥_\-]/g, '_');
  };

  return {
    isExporting,
    exportToPdf,
    sanitizeFilename,
  };
}
