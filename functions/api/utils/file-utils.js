/**
 * 通用文件处理工具
 * 封装文件上传、CAS 去重、数据库记录等逻辑
 * @module utils/file-utils
 */

import { generateId, now } from './id.js';
import { MSG } from './messages.js';
import { getBlobByHash, createBlob, incrementRefCount } from './blob-utils.js';

/**
 * 存储文件（支持 CAS 秒传）
 * @param {Object} env 环境对象
 * @param {File} file 文件对象
 * @param {Object} options 选项
 * @param {string} [options.contentHash] 文件内容的 SHA-256 哈希（用于去重）
 * @param {string} [options.folderId='root'] 目标文件夹 ID
 * @param {string} [options.createdBy] 创建者信息（可选）
 * @returns {Promise<Object>} 上传结果 { id, storage_key, url, ... }
 */
export async function storeFile(env, file, options = {}) {
    const { contentHash, folderId = 'root', createdBy } = options;

    if (!file || !(file instanceof File)) {
        throw new Error(MSG.FILE.SELECT_FILE);
    }

    // 1. 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error(MSG.FILE.INVALID_TYPE);
    }

    // 2. 验证文件大小 (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error(MSG.FILE.SIZE_LIMIT);
    }

    let storageKey;
    let isInstantUpload = false;

    // 3. CAS 秒传检测
    if (contentHash) {
        const existingBlob = await getBlobByHash(env, contentHash);
        if (existingBlob) {
            // 秒传：增加引用计数，复用已有 blob
            await incrementRefCount(env, contentHash);
            storageKey = contentHash;
            isInstantUpload = true;
        }
    }

    // 4. 实际上传 (如果无法秒传)
    if (!storageKey) {
        // 使用 content_hash 作为 storage_key（如果提供），否则生成随机 key
        // 为了最大化去重，建议前端即使第一传也计算 Hash
        storageKey = contentHash || `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

        // 上传到 R2
        await env.R2_BUCKET.put(storageKey, file.stream(), {
            httpMetadata: { contentType: file.type },
        });

        // 如果提供了 hash，创建 blob 记录
        if (contentHash) {
            await createBlob(env, contentHash, file.size, file.type);
        }
    }

    // 5. 保存到数据库 (Files 表总是创建新记录)
    const fileId = generateId();
    const timestamp = now();

    await env.DB.prepare(`
        INSERT INTO files (
            id, name, storage_key, original_name, mime_type, size, 
            folder_id, content_hash, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        fileId,
        file.name,
        storageKey,
        file.name,
        file.type,
        file.size,
        folderId,
        contentHash || null,
        createdBy || null,
        timestamp,
        timestamp
    ).run();

    return {
        id: fileId,
        storageKey: storageKey,
        storage_key: storageKey, // 兼容旧代码
        name: file.name,
        size: file.size,
        type: file.type,
        url: `/file/${storageKey}`,
        instantUpload: isInstantUpload
    };
}
