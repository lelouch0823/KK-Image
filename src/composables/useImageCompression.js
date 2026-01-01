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
    useWebWorker: true,              // 启用 Web Worker (失败会自动降级)
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
    // 优先使用 Web Crypto API (仅 HTTPS/localhost 可用)
    if (window.crypto && window.crypto.subtle) {
        try {
            const buffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.warn('[SHA256] Web Crypto API failed, falling back to simple hash', e);
        }
    } else {
        console.warn('[SHA256] Web Crypto API unavailable (Secure Context required), using simple hash fallback');
    }

    // Fallback: 简单的伪哈希 (仅用于非安全环境开发测试)
    // 格式: fallback-{size}-{lastModified}-{filenameHash}
    const str = file.name + file.size + file.lastModified;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    const hex = (hash >>> 0).toString(16).padStart(8, '0');
    return `fallback-${file.size}-${hex}`;
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
     *   hash: string,         // 压缩后文件的 SHA-256 (用于 CAS)
     *   originalHash: string, // 原始文件的 SHA-256 (用于跨设备去重)
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

        // ⚡ SOTA: 先计算原始文件 hash (用于预检查去重)
        const originalHash = await computeSHA256(file);

        // 如果是 GIF，跳过压缩（保留动画）
        if (file.type === 'image/gif') {
            return {
                file,
                hash: originalHash,  // GIF 不压缩，所以 hash 相同
                originalHash,
                originalSize,
                compressedSize: file.size,
                ratio: 1,
                skipped: true
            };
        }

        // 执行压缩
        let compressedBlob;
        try {

            compressedBlob = await imageCompression(file, {
                ...options,
                onProgress: (progress) => onProgress(Math.round(progress))
            });
        } catch (err) {
            console.warn('[Compression] Web Worker compression failed, falling back to main thread:', err);
            // Fallback: 禁用 Web Worker 重试
            try {
                compressedBlob = await imageCompression(file, {
                    ...options,
                    useWebWorker: false,
                    onProgress: (progress) => onProgress(Math.round(progress))
                });

            } catch (fallbackErr) {
                console.error('[Compression] All compression attempts failed:', fallbackErr);
                throw fallbackErr;
            }
        }

        // 保持原始文件名，改为 .webp 扩展名
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const newFileName = `${baseName}.webp`;

        const compressedFile = new File([compressedBlob], newFileName, {
            type: options.fileType || compressedBlob.type
        });

        // 计算压缩后文件的哈希 (用于 CAS 存储)
        const hash = await computeSHA256(compressedFile);



        return {
            file: compressedFile,
            hash,             // 压缩后 hash
            originalHash,     // 原始文件 hash
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
