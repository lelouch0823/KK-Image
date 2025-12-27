/**
 * @fileoverview Cloudflare R2 存储提供者
 * @module storage/providers/r2
 * 
 * 符合 Cloudflare R2 官方最佳实践:
 * - 使用 writeHttpMetadata() 写入响应头
 * - 支持条件请求 (onlyIf)
 * - 支持 Range 请求
 */

import { BaseStorageProvider } from '../base-provider.js';

/**
 * Cloudflare R2 存储提供者
 * 使用 Cloudflare R2 对象存储保存文件
 */
export class R2StorageProvider extends BaseStorageProvider {
    constructor(env) {
        super(env);
        this.name = 'r2';
    }

    /**
     * 检查 R2 配置是否完整
     * @returns {boolean}
     */
    isConfigured() {
        // R2 桶通过 wrangler.toml 绑定
        return !!(this.env.R2_BUCKET);
    }

    /**
     * 上传文件到 R2
     * @param {File|Blob} file
     * @param {Object} options
     * @returns {Promise<import('../base-provider.js').UploadResult>}
     */
    async upload(file, options = {}) {
        if (!this.isConfigured()) {
            return { success: false, error: 'R2 not configured' };
        }

        const fileName = options.fileName || file.name || 'file';
        const fileId = this.generateFileId(fileName);
        const contentType = file.type || options.contentType || 'application/octet-stream';

        try {
            // 上传到 R2 - 使用官方推荐的 httpMetadata
            await this.env.R2_BUCKET.put(fileId, file, {
                httpMetadata: {
                    contentType: contentType,
                    // 设置缓存控制头
                    cacheControl: 'public, max-age=31536000'
                },
                customMetadata: {
                    originalName: fileName,
                    uploadTime: new Date().toISOString(),
                    ...options.metadata
                }
            });

            return {
                success: true,
                fileId: fileId,
                url: getFileUrl(fileId),
                metadata: {
                    storageProvider: this.name,
                    storageId: fileId,
                    fileName: fileName,
                    fileSize: file.size,
                    contentType: contentType
                }
            };
        } catch (error) {
            console.error('R2 upload error:', error);
            return { success: false, error: `R2 upload failed: ${error.message}` };
        }
    }

    /**
     * 从 R2 获取文件（符合官方最佳实践）
     * @param {string} fileId
     * @param {Request} [request]
     * @returns {Promise<Response>}
     */
    async getFile(fileId, request) {
        if (!this.isConfigured()) {
            return new Response('R2 not configured', { status: 500 });
        }

        try {
            // 使用官方推荐的 onlyIf 和 range 参数处理条件请求
            const object = await this.env.R2_BUCKET.get(fileId, {
                onlyIf: request?.headers,
                range: request?.headers
            });

            if (object === null) {
                return new Response('File not found', { status: 404 });
            }

            const headers = new Headers();

            // 使用官方推荐的 writeHttpMetadata 方法
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);

            // 当 body 不存在时，表示条件未满足（如 If-None-Match 匹配）
            if (!('body' in object)) {
                return new Response(null, { status: 304, headers });
            }

            // 检查是否为 Range 请求响应
            const status = object.range ? 206 : 200;

            return new Response(object.body, { status, headers });
        } catch (error) {
            console.error('R2 get file error:', error);
            return new Response('Failed to retrieve file', { status: 500 });
        }
    }

    /**
     * 从 R2 删除文件
     * @param {string} fileId
     * @returns {Promise<boolean>}
     */
    async deleteFile(fileId) {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            await this.env.R2_BUCKET.delete(fileId);
            return true;
        } catch (error) {
            console.error('R2 delete error:', error);
            return false;
        }
    }

    /**
     * 列出 R2 中的文件
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async listFiles(options = {}) {
        if (!this.isConfigured()) {
            return [];
        }

        try {
            const listed = await this.env.R2_BUCKET.list({
                limit: options.limit || 100,
                cursor: options.cursor,
                prefix: options.prefix
            });

            return listed.objects.map(obj => ({
                fileId: obj.key,
                size: obj.size,
                uploadTime: obj.uploaded,
                etag: obj.etag
            }));
        } catch (error) {
            console.error('R2 list error:', error);
            return [];
        }
    }
}
