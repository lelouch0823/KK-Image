/**
 * @fileoverview Telegram 存储提供者 - 使用 Telegram Bot API 存储文件
 * @module storage/providers/telegram
 */

import { BaseStorageProvider } from '../base-provider.js';

/**
 * Telegram 存储提供者
 * 将文件上传到 Telegram 频道并通过 Bot API 获取
 */
export class TelegramStorageProvider extends BaseStorageProvider {
    constructor(env) {
        super(env);
        this.name = 'telegram';
    }

    /**
     * 检查 Telegram 配置是否完整
     * @returns {boolean}
     */
    isConfigured() {
        return !!(this.env.TG_Bot_Token && this.env.TG_Chat_ID);
    }

    /**
     * 上传文件到 Telegram
     * @param {File|Blob} file
     * @param {Object} options
     * @returns {Promise<import('../base-provider.js').UploadResult>}
     */
    async upload(file, options = {}) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Telegram not configured' };
        }

        const fileName = options.fileName || file.name || 'file';
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

        const formData = new FormData();
        formData.append('chat_id', this.env.TG_Chat_ID);

        // 根据文件类型选择合适的上传方式
        let apiEndpoint;
        const contentType = file.type || options.contentType || '';

        if (contentType.startsWith('image/')) {
            formData.append('photo', file);
            apiEndpoint = 'sendPhoto';
        } else if (contentType.startsWith('audio/')) {
            formData.append('audio', file);
            apiEndpoint = 'sendAudio';
        } else if (contentType.startsWith('video/')) {
            formData.append('video', file);
            apiEndpoint = 'sendVideo';
        } else {
            formData.append('document', file);
            apiEndpoint = 'sendDocument';
        }

        const result = await this._sendToTelegram(formData, apiEndpoint);

        if (!result.success) {
            return result;
        }

        const telegramFileId = this._extractFileId(result.data);
        if (!telegramFileId) {
            return { success: false, error: 'Failed to extract file ID from Telegram response' };
        }

        const fileId = `${telegramFileId}.${fileExtension}`;

        return {
            success: true,
            fileId: fileId,
            url: `/file/${fileId}`,
            metadata: {
                storageProvider: this.name,
                storageId: telegramFileId,
                fileName: fileName,
                fileSize: file.size
            }
        };
    }

    /**
     * 从 Telegram 获取文件
     * @param {string} fileId
     * @param {Request} [request]
     * @returns {Promise<Response>}
     */
    async getFile(fileId, request) {
        // 提取 Telegram file_id（去除扩展名）
        const telegramFileId = fileId.split('.')[0];

        // 获取文件路径
        const filePath = await this._getFilePath(telegramFileId);
        if (!filePath) {
            return new Response('File not found', { status: 404 });
        }

        const fileUrl = `https://api.telegram.org/file/bot${this.env.TG_Bot_Token}/${filePath}`;

        return fetch(fileUrl, {
            method: request?.method || 'GET',
            headers: request?.headers
        });
    }

    /**
     * 删除文件（Telegram 不支持删除，仅返回 true）
     * @param {string} fileId
     * @returns {Promise<boolean>}
     */
    async deleteFile(fileId) {
        // Telegram 不支持删除已上传的文件
        // 但我们可以从 KV 元数据中移除记录
        console.warn('Telegram does not support file deletion');
        return true;
    }

    /**
     * 发送文件到 Telegram
     * @private
     */
    async _sendToTelegram(formData, apiEndpoint, retryCount = 0) {
        const MAX_RETRIES = 2;
        const apiUrl = `https://api.telegram.org/bot${this.env.TG_Bot_Token}/${apiEndpoint}`;

        try {
            const response = await fetch(apiUrl, { method: 'POST', body: formData });
            const responseData = await response.json();

            if (response.ok) {
                return { success: true, data: responseData };
            }

            // 图片上传失败时转为文档方式重试
            if (retryCount < MAX_RETRIES && apiEndpoint === 'sendPhoto') {
                const newFormData = new FormData();
                newFormData.append('chat_id', formData.get('chat_id'));
                newFormData.append('document', formData.get('photo'));
                return await this._sendToTelegram(newFormData, 'sendDocument', retryCount + 1);
            }

            return {
                success: false,
                error: responseData.description || 'Upload to Telegram failed'
            };
        } catch (error) {
            console.error('Telegram network error:', error);
            if (retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return await this._sendToTelegram(formData, apiEndpoint, retryCount + 1);
            }
            return { success: false, error: 'Network error occurred' };
        }
    }

    /**
     * 从 Telegram 响应中提取文件 ID
     * @private
     */
    _extractFileId(response) {
        if (!response.ok || !response.result) return null;

        const result = response.result;
        if (result.photo) {
            // 取最大尺寸的图片
            return result.photo.reduce((prev, current) =>
                (prev.file_size > current.file_size) ? prev : current
            ).file_id;
        }
        if (result.document) return result.document.file_id;
        if (result.video) return result.video.file_id;
        if (result.audio) return result.audio.file_id;

        return null;
    }

    /**
     * 获取 Telegram 文件路径
     * @private
     */
    async _getFilePath(fileId) {
        const url = `https://api.telegram.org/bot${this.env.TG_Bot_Token}/getFile?file_id=${fileId}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.ok && data.result?.file_path) {
                return data.result.file_path;
            }
        } catch (error) {
            console.error('Failed to get Telegram file path:', error);
        }

        return null;
    }
}
