/**
 * @fileoverview 存储提供者基类 - 定义存储接口规范
 * @module storage/base-provider
 */

import { getFileUrl } from '../api/utils/url.js';

/**
 * @typedef {Object} UploadResult
 * @property {boolean} success - 是否成功
 * @property {string} [fileId] - 文件 ID
 * @property {string} [url] - 访问 URL
 * @property {string} [error] - 错误信息
 * @property {Object} [metadata] - 额外元数据
 */

/**
 * @typedef {Object} UploadOptions
 * @property {string} [fileName] - 文件名
 * @property {string} [contentType] - 内容类型
 * @property {Object} [metadata] - 自定义元数据
 */

/**
 * 存储提供者基类
 * 所有存储提供者必须继承此类并实现抽象方法
 */
export class BaseStorageProvider {
    /**
     * @param {Object} env - Cloudflare Workers 环境对象
     */
    constructor(env) {
        this.env = env;
        /** @type {string} */
        this.name = 'base';
    }

    /**
     * 检查提供者是否已正确配置
     * @returns {boolean}
     */
    isConfigured() {
        throw new Error('Method not implemented: isConfigured()');
    }

    /**
     * 上传文件
     * @param {File|Blob} file - 要上传的文件
     * @param {UploadOptions} [options] - 上传选项
     * @returns {Promise<UploadResult>}
     */
    async upload(file, options = {}) {
        throw new Error('Method not implemented: upload()');
    }

    /**
     * 获取文件
     * @param {string} fileId - 文件 ID
     * @param {Request} [request] - 原始请求（用于传递 headers）
     * @returns {Promise<Response>}
     */
    async getFile(fileId, request) {
        throw new Error('Method not implemented: getFile()');
    }

    /**
     * 删除文件
     * @param {string} fileId - 文件 ID
     * @returns {Promise<boolean>}
     */
    async deleteFile(fileId) {
        throw new Error('Method not implemented: deleteFile()');
    }

    /**
     * 获取文件的公开 URL
     * @param {string} fileId - 文件 ID
     * @param {string} origin - 请求源
     * @returns {string}
     */
    getPublicUrl(fileId, origin) {
        return getFileUrl(fileId, origin);
    }

    /**
     * 生成唯一文件 ID
     * @param {string} fileName - 原始文件名
     * @returns {string}
     */
    generateFileId(fileName) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        return `${timestamp}-${random}${ext ? '.' + ext : ''}`;
    }
}
