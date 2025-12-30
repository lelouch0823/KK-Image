/**
 * 共享空间数据转换器
 * 将数据库记录转换为 API 响应格式
 */

import { getShareUrl, getFileUrl } from '../../../../../api/utils/url.js';

/**
 * 转换空间列表项
 * @param {Object} space - 数据库空间记录
 * @returns {Object} API 响应格式
 */
export function transformSpaceListItem(space) {
    return {
        id: space.id,
        name: space.name,
        description: space.description,
        isPublic: Boolean(space.is_public),
        hasPassword: !!space.password,
        shareToken: space.share_token,
        shareUrl: getShareUrl(space.share_token, 'space'),
        fileCount: space.file_count || 0,
        expiresAt: space.expires_at,
        template: space.template,
        coverFileId: space.cover_file_id,
        coverUrl: space.cover_storage_key ? getFileUrl(space.cover_storage_key) : null,
        viewCount: space.view_count || 0,
        createdAt: space.created_at,
        updatedAt: space.updated_at
    };
}

/**
 * 转换空间详情
 * @param {Object} space - 数据库空间记录
 * @param {Array} files - 关联文件列表
 * @returns {Object} API 响应格式
 */
export function transformSpaceDetail(space, files = []) {
    return {
        id: space.id,
        name: space.name,
        description: space.description,
        isPublic: Boolean(space.is_public),
        hasPassword: !!space.password,
        shareToken: space.share_token,
        shareUrl: getShareUrl(space.share_token, 'space'),
        expiresAt: space.expires_at,
        template: space.template,
        templateData: space.template_data ? JSON.parse(space.template_data) : {},
        coverFileId: space.cover_file_id,
        viewCount: space.view_count,
        createdAt: space.created_at,
        updatedAt: space.updated_at,
        files: files.map(transformFile)
    };
}

/**
 * 转换文件记录
 * @param {Object} file - 数据库文件记录
 * @returns {Object} API 响应格式
 */
export function transformFile(file) {
    return {
        id: file.id,
        name: file.name,
        originalName: file.original_name,
        size: file.size,
        mimeType: file.mime_type,
        url: getFileUrl(file.storage_key),
        createdAt: file.created_at
    };
}

/**
 * 转换空间统计数据
 * @param {Object} space - 空间记录
 * @param {Object} fileStats - 文件统计
 * @param {Array} trend - 趋势数据
 * @returns {Object} API 响应格式
 */
export function transformSpaceStats(space, fileStats, trend = []) {
    return {
        total: {
            view_count: space?.view_count || 0,
            download_count: space?.download_count || 0
        },
        fileCount: fileStats?.file_count || 0,
        totalSize: fileStats?.total_size || 0,
        trend
    };
}
