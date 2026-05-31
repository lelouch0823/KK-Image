/**
 * Image Compression Composable
 * SOTA implementation using browser-image-compression library
 *
 * Features:
 * - WebP output format
 * - Web Worker support (non-blocking)
 * - EXIF orientation preservation
 * - SHA-256 hash computation for deduplication
 */

import imageCompression from 'browser-image-compression';

import { useWatermarkSettings } from './useWatermarkSettings';

interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  preserveExif?: boolean;
  initialQuality?: number;
  applyWatermark?: boolean;
}

interface CompressionResult {
  file: File;
  hash: string;
  originalHash: string;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  skipped?: boolean;
}

interface CompressionSuccessResult extends CompressionResult {
  success: true;
}

interface CompressionFailureResult {
  success: false;
  file: File;
  error: string;
}

interface WatermarkOptions {
  enabled: boolean;
  text: string;
  position: string;
  opacity: number;
  color: string;
  sizeRatio: number;
}

/**
 * 默认压缩配置
 */
const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxSizeMB: 1, // 最大 1MB
  maxWidthOrHeight: 1920, // 最大边 1920px
  useWebWorker: true, // 启用 Web Worker (失败会自动降级)
  fileType: 'image/webp', // 输出 WebP 格式
  preserveExif: true, // 保留 EXIF 方向
  initialQuality: 0.8, // 初始质量 80%
  applyWatermark: true, // 是否应用全局水印
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

function resolveOutputFileName(originalName: string, mimeType: string): string {
  const baseName = String(originalName || 'image').replace(/\.[^.]+$/, '');
  const normalizedMime = String(mimeType || '').toLowerCase();
  const extension = MIME_EXTENSION_MAP[normalizedMime] || 'img';
  return `${baseName}.${extension}`;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 计算文件的 SHA-256 哈希
 * @param file
 * @returns 十六进制哈希字符串
 */
async function computeSHA256(file: File | Blob & { name?: string; lastModified?: number }): Promise<string> {
  // 优先使用 Web Crypto API (仅 HTTPS/localhost 可用)
  if (window.crypto && window.crypto.subtle) {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('[SHA256] Web Crypto API failed, falling back to simple hash', e);
    }
  } else {
    console.warn(
      '[SHA256] Web Crypto API unavailable (Secure Context required), using simple hash fallback'
    );
  }

  // Fallback: 简单的伪哈希 (仅用于非安全环境开发测试)
  // 格式: fallback-{size}-{lastModified}-{filenameHash}
  const str = (file.name || '') + file.size + (file.lastModified || 0);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `fallback-${file.size}-${hex}`;
}

/**
 * 绘制水印
 * @param file - 原始图片文件
 * @param watermarkOptions - 水印配置选项
 * @returns 绘制好水印的新 File
 */
async function drawWatermark(file: File, watermarkOptions: WatermarkOptions): Promise<File> {
  if (!watermarkOptions || !watermarkOptions.enabled) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.warn('Canvas 2D context not available. Skipping watermark.');
        return resolve(file);
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const { text, position, opacity, color, sizeRatio } = watermarkOptions;

      // Calculate font size
      const fontSize = Math.max(12, Math.floor(Math.min(canvas.width, canvas.height) * sizeRatio));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const textHeight = fontSize; // Approximate

      const padding = Math.max(10, fontSize / 2);

      let x = 0;
      let y = 0;

      switch (position) {
        case 'bottom-right':
          x = canvas.width - (textWidth / 2) - padding;
          y = canvas.height - (textHeight / 2) - padding;
          break;
        case 'bottom-left':
          x = (textWidth / 2) + padding;
          y = canvas.height - (textHeight / 2) - padding;
          break;
        case 'top-right':
          x = canvas.width - (textWidth / 2) - padding;
          y = (textHeight / 2) + padding;
          break;
        case 'top-left':
          x = (textWidth / 2) + padding;
          y = (textHeight / 2) + padding;
          break;
        case 'center':
          x = canvas.width / 2;
          y = canvas.height / 2;
          break;
        default:
          x = canvas.width - (textWidth / 2) - padding;
          y = canvas.height - (textHeight / 2) - padding;
      }

      // Add a subtle shadow to improve visibility on differently colored backgrounds
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillText(text, x, y);

      canvas.toBlob((blob) => {
        if (!blob) {
          console.warn('Canvas toBlob failed. Skipping watermark.');
          return resolve(file);
        }
        // Retain the original file mime type if possible, or use png as safe fallback

        const watermarkedFile = new File([blob], `wm_${file.name}`, {
          type: blob.type || file.type,
          lastModified: Date.now()
        });
        resolve(watermarkedFile);
      }, file.type, 1.0); // Try to preserve original quality here before browser-image-compression
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.warn('Failed to load image for watermarking. Skipping watermark.');
      resolve(file); // fallback to original file
    };
    img.src = url;
  });
}

/**
 * 图片压缩 Composable
 * @param customOptions - 自定义压缩选项
 */
export function useImageCompression(customOptions: CompressionOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  const { loadSettings, getSettingsParsed } = useWatermarkSettings();

  /**
   * 压缩单张图片
   * @param file - 原始图片文件
   * @param onProgress - 进度回调 (0-100)
   */
  const compressImage = async (file: File, onProgress: (progress: number) => void = () => {}): Promise<CompressionResult> => {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Invalid image file');
    }

    const originalSize = file.size;

    // 先计算原始文件 hash (用于预检查去重)
    const originalHash = await computeSHA256(file);

    // 如果是 GIF，跳过压缩和水印（保留动画）
    if (file.type === 'image/gif') {
      return {
        file,
        hash: originalHash, // GIF 不压缩，所以 hash 相同
        originalHash,
        originalSize,
        compressedSize: file.size,
        ratio: 1,
        skipped: true,
      };
    }

    // 1. Load and apply watermark if configured
    let fileToCompress = file;
    if (options.applyWatermark) {
      await loadSettings();
      const wmConfig = getSettingsParsed();
      if (wmConfig && wmConfig.enabled) {
        fileToCompress = await drawWatermark(file, wmConfig);
      }
    }

    // 2. 执行压缩
    let compressedBlob: Blob;
    try {
      compressedBlob = await imageCompression(fileToCompress, {
        ...options,
        onProgress: (progress: number) => onProgress(Math.round(progress)),
      });
    } catch (err) {
      console.warn(
        '[Compression] Web Worker compression failed, falling back to main thread:',
        err
      );
      // Fallback: 禁用 Web Worker 重试
      try {
        compressedBlob = await imageCompression(fileToCompress, {
          ...options,
          useWebWorker: false,
          onProgress: (progress: number) => onProgress(Math.round(progress)),
        });
      } catch (fallbackErr) {
        console.error('[Compression] All compression attempts failed:', fallbackErr);
        throw fallbackErr;
      }
    }

    const outputType = options.fileType || compressedBlob.type || file.type;
    const newFileName = resolveOutputFileName(file.name, outputType);

    const compressedFile = new File([compressedBlob], newFileName, {
      type: outputType,
    });

    // 计算压缩后文件的哈希 (用于 CAS 存储)
    const hash = await computeSHA256(compressedFile);

    return {
      file: compressedFile,
      hash, // 压缩后 hash
      originalHash, // 原始文件 hash (注意：即使用户启用了水印，这里传回去给服务器做去重的 originalHash 依然是打水印前最纯净的原始图片 Hash，确保了预检命中)
      originalSize,
      compressedSize: compressedFile.size,
      ratio: compressedFile.size / originalSize,
    };
  };

  /**
   * 批量压缩图片
   * @param files - 图片文件数组
   * @param onItemProgress - 单项进度回调 (index, progress)
   */
  const compressImages = async (files: File[], onItemProgress: (index: number, progress: number) => void = () => {}): Promise<(CompressionSuccessResult | CompressionFailureResult)[]> => {
    const results: (CompressionSuccessResult | CompressionFailureResult)[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const result = await compressImage(files[i], (progress) => {
          onItemProgress(i, progress);
        });
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({
          success: false,
          file: files[i],
          error: (error as Error).message,
        });
      }
    }

    return results;
  };

  /**
   * 仅计算文件哈希（不压缩）
   */
  const getFileHash = computeSHA256;

  /**
   * 获取图片尺寸
   * @param file
   */
  const getImageDimensions = async (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };
      img.src = URL.createObjectURL(file);
    });
  };

  /**
   * 压缩并返回 data URL（适用于 AI 多模态输入）
   * @param file
   * @param onProgress
   */
  const compressImageToDataUrl = async (file: File, onProgress: (progress: number) => void = () => {}): Promise<CompressionResult & { dataUrl: string }> => {
    const result = await compressImage(file, onProgress);
    const dataUrl = await blobToDataURL(result.file);
    return {
      ...result,
      dataUrl,
    };
  };

  return {
    compressImage,
    compressImageToDataUrl,
    compressImages,
    getFileHash,
    getImageDimensions,
    options,
  };
}
