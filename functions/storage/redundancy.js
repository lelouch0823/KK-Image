/**
 * @fileoverview 冗余存储管理器 - 管理多存储同步和镜像
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

    // ... (中间代码保持不变) ...

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

                    // 更新 KV 中的镜像状态
                    if (result.success && this.env.img_url) {
                        await this._updateMirrorStatus(primaryFileId, mirrorName, result.fileId, 'synced');
                    }
                } catch (error) {
                    console.error(`Async mirror to ${mirrorName} failed:`, error);
                    if (this.env.img_url) {
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
     * 更新 KV 中的镜像状态
     * @private
     */
    async _updateMirrorStatus(fileId, mirrorProvider, mirrorId, status, error = null) {
        try {
            const record = await this.env.img_url.getWithMetadata(fileId);
            if (record && record.metadata) {
                const metadata = record.metadata;

                // 确保 storage.mirrors 存在
                if (!metadata.storage) {
                    metadata.storage = { mirrors: [] };
                }
                if (!metadata.storage.mirrors) {
                    metadata.storage.mirrors = [];
                }

                // 更新或添加镜像状态
                const existingIndex = metadata.storage.mirrors.findIndex(m => m.provider === mirrorProvider);
                const mirrorInfo = {
                    provider: mirrorProvider,
                    id: mirrorId,
                    status: status,
                    syncedAt: new Date().toISOString()
                };
                if (error) {
                    mirrorInfo.error = error;
                }

                if (existingIndex >= 0) {
                    metadata.storage.mirrors[existingIndex] = mirrorInfo;
                } else {
                    metadata.storage.mirrors.push(mirrorInfo);
                }

                await this.env.img_url.put(fileId, "", { metadata });
            }
        } catch (err) {
            console.error('Failed to update mirror status:', err);
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
                    const mirror = metadata.storage.mirrors?.find(m => m.provider === providerName);
                    if (mirror?.id) {
                        targetFileId = mirror.id;
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
