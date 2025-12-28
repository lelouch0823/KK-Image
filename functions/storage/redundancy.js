/**
 * @fileoverview 冗余存储管理器 - 管理多存储同步和镜像 (D1 版本)
 * @module storage/redundancy
 */

import { getStorageProvider } from './index.js';
import { SmartRouter } from './router.js';

/**
 * 冗余存储管理器
 */
export class RedundancyManager {
    /**
     * @param {Object} env - 环境变量
     * @param {ExecutionContext} [context] - Workers 执行上下文 (用于 waitUntil)
     */
    constructor(env, context = null) {
        this.env = env;
        this.context = context;
        this.router = new SmartRouter(env);
    }

    /**
     * 异步镜像上传（后台处理）
     * @private
     */
    _mirrorAsync(file, options, mirrors, primaryFileId, storageInfo) {
        // 后台镜像任务
        const mirrorTask = async () => {
            for (const mirrorName of mirrors) {
                try {
                    const provider = getStorageProvider(this.env, mirrorName);
                    const result = await provider.upload(file, options);

                    // 更新 D1 中的镜像状态
                    if (result.success && this.env.DB) {
                        await this._updateMirrorStatus(primaryFileId, mirrorName, result.fileId, 'synced');
                    }
                } catch (error) {
                    console.error(`Async mirror to ${mirrorName} failed:`, error);
                    if (this.env.DB) {
                        await this._updateMirrorStatus(primaryFileId, mirrorName, null, 'failed', error.message);
                    }
                }
            }
        };

        // 使用 context.waitUntil 确保后台任务完成
        if (this.context && typeof this.context.waitUntil === 'function') {
            this.context.waitUntil(mirrorTask());
        } else {
            // 如果没有 context (如测试环境)，则不等待但捕获错误
            console.warn('RedundancyManager: No context provided for async mirror, task may be cancelled.');
            mirrorTask().catch(err => console.error('Mirror task failed:', err));
        }
    }

    /**
     * 更新 D1 中的镜像状态
     * @private
     */
    async _updateMirrorStatus(fileId, mirrorProvider, mirrorId, status, error = null) {
        if (!this.env.DB) {
            return;
        }

        try {
            const now = Date.now();

            // 使用 UPSERT (INSERT OR REPLACE)
            await this.env.DB.prepare(`
                INSERT OR REPLACE INTO storage_mirrors (file_id, provider, provider_file_id, status, error, synced_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
                fileId,
                mirrorProvider,
                mirrorId,
                status,
                error,
                now
            ).run();
        } catch (err) {
            console.error('Failed to update mirror status:', err);
        }
    }

    /**
     * 获取文件的镜像状态
     */
    async getMirrorStatus(fileId) {
        if (!this.env.DB) {
            return [];
        }

        try {
            const { results } = await this.env.DB.prepare(
                'SELECT * FROM storage_mirrors WHERE file_id = ?'
            ).bind(fileId).all();

            return results.map(row => ({
                provider: row.provider,
                id: row.provider_file_id,
                status: row.status,
                error: row.error,
                syncedAt: row.synced_at
            }));
        } catch (err) {
            console.error('Failed to get mirror status:', err);
            return [];
        }
    }
}

/**
 * 获取带回退的文件
 * @param {Object} env - 环境变量
 * @param {string} fileId - 文件 ID
 * @param {Request} request - 原始请求
 * @param {Object} metadata - 文件元数据
 * @returns {Promise<Response>}
 */
export async function getFileWithFallback(env, fileId, request, metadata) {
    const { getFallbackChain, isFallbackEnabled, getFallbackTimeout } = await import('./router.js');

    // 如果未启用回退，使用默认提供者
    if (!isFallbackEnabled(env)) {
        const provider = getStorageProvider(env);
        return provider.getFile(fileId, request);
    }

    // 从 D1 获取镜像信息
    let mirrors = [];
    if (env.DB) {
        const { results } = await env.DB.prepare(
            'SELECT * FROM storage_mirrors WHERE file_id = ? AND status = ?'
        ).bind(fileId, 'synced').all();
        mirrors = results;
    }

    const chain = getFallbackChain(env, metadata);
    const timeout = getFallbackTimeout(env);

    for (const providerName of chain) {
        try {
            const provider = getStorageProvider(env, providerName);

            // 获取该存储中的文件 ID
            let targetFileId = fileId;
            if (metadata?.storage) {
                if (metadata.storage.primary === providerName) {
                    targetFileId = metadata.storage.primaryId || fileId;
                } else {
                    // 从 D1 镜像表查找
                    const mirror = mirrors.find(m => m.provider === providerName);
                    if (mirror?.provider_file_id) {
                        targetFileId = mirror.provider_file_id;
                    }
                }
            }

            // 使用超时控制
            const response = await Promise.race([
                provider.getFile(targetFileId, request),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), timeout)
                )
            ]);

            if (response.ok) {
                return response;
            }
        } catch (error) {
            console.warn(`Fallback: ${providerName} failed for ${fileId}:`, error.message);
        }
    }

    return new Response('File not found in any storage', { status: 404 });
}
