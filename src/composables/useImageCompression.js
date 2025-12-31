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

/**
 * 默认压缩配置
 */
const DEFAULT_OPTIONS = {
    maxSizeMB: 1,                    // 最大 1MB
    maxWidthOrHeight: 1920,          // 最大边 1920px
    useWebWorker: true,              // Web Worker 不阻塞 UI
    fileType: 'image/webp',          // 输出 WebP 格式
    preserveExif: true,              // 保留 EXIF 方向
    initialQuality: 0.8,             // 初始质量 80%
};

/**
 * 计算文件的 SHA-256 哈希
 * @param {File|Blob} file 
 * @returns {Promise<string>} 十六进制哈希字符串
 */
async function computeSHA256(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 图片压缩 Composable
 * @param {Object} customOptions - 自定义压缩选项
 */
export function useImageCompression(customOptions = {}) {
    const options = { ...DEFAULT_OPTIONS, ...customOptions };

    /**
     * 压缩单张图片
     * @param {File} file - 原始图片文件
     * @param {Function} onProgress - 进度回调 (0-100)
     * @returns {Promise<{
     *   file: File,
     *   hash: string,
     *   originalSize: number,
     *   compressedSize: number,
     *   ratio: number
     * }>}
     */
    const compressImage = async (file, onProgress = () => { }) => {
        if (!file || !file.type.startsWith('image/')) {
            throw new Error('Invalid image file');
        }

        const originalSize = file.size;

        // 如果是 GIF，跳过压缩（保留动画）
        if (file.type === 'image/gif') {
            const hash = await computeSHA256(file);
            return {
                file,
                hash,
                originalSize,
                compressedSize: file.size,
                ratio: 1,
                skipped: true
            };
        }

        // 执行压缩
        const compressedBlob = await imageCompression(file, {
            ...options,
            onProgress: (progress) => onProgress(Math.round(progress))
        });

        // 保持原始文件名，改为 .webp 扩展名
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const newFileName = `${baseName}.webp`;

        const compressedFile = new File([compressedBlob], newFileName, {
            type: options.fileType || compressedBlob.type
        });

        // 计算哈希
        const hash = await computeSHA256(compressedFile);

        return {
            file: compressedFile,
            hash,
            originalSize,
            compressedSize: compressedFile.size,
            ratio: compressedFile.size / originalSize
        };
    };

    /**
     * 批量压缩图片
     * @param {File[]} files - 图片文件数组
     * @param {Function} onItemProgress - 单项进度回调 (index, progress)
     * @returns {Promise<Array>}
     */
    const compressImages = async (files, onItemProgress = () => { }) => {
        const results = [];

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
                    error: error.message
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
     * @param {File} file 
     * @returns {Promise<{width: number, height: number}>}
     */
    const getImageDimensions = async (file) => {
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

    return {
        compressImage,
        compressImages,
        getFileHash,
        getImageDimensions,
        options
    };
}
