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
   * 上传文件（包含冗余处理）
   * @param {File|Blob} file - 上传的文件
   * @param {Object} options - 上传选项
   * @returns {Promise<Object>} 上传结果
   */
  async upload(file, options) {
    // 1. 选择主存储
    const primaryProviderName = this.router.selectStorage(file);
    const primaryProvider = getStorageProvider(this.env, primaryProviderName);

    if (!primaryProvider) {
      throw new Error(`Storage provider '${primaryProviderName}' not found`);
    }

    // 2. 上传到主存储
    let result;
    try {
      result = await primaryProvider.upload(file, options);
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error(`Upload to primary storage (${primaryProviderName}) failed:`, error);
      throw error;
    }

    // 3. 处理镜像上传
    const mirrors = this.router.getMirrors();
    const secondaryMirrors = mirrors.filter((m) => m !== primaryProviderName);

    if (secondaryMirrors.length > 0) {
      const storageMetadata = {
        primary: primaryProviderName,
        primaryId: result.fileId,
        mirrors: [],
      };

      // 如果结果中已有 metadata，合并它
      if (result.metadata) {
        result.metadata.storage = storageMetadata;
      } else {
        result.metadata = { storage: storageMetadata };
      }

      // 镜像上传始终异步执行，不阻塞主上传响应
      // 使用 context.waitUntil 确保后台任务完成
      this._mirrorAsync(file, options, secondaryMirrors, result.fileId, storageMetadata);
    } else {
      // 即使没有镜像，也记录主存储信息
      if (!result.metadata) result.metadata = {};
      result.metadata.storage = {
        primary: primaryProviderName,
        primaryId: result.fileId,
      };
    }

    return result;
  }

  /**
   * 异步镜像上传（后台处理，SOTA: 并发执行）
   * @private
   */
  _mirrorAsync(file, options, mirrors, primaryFileId, _storageInfo) {
    // 后台镜像任务 - 使用 Promise.all 并发执行所有镜像
    const mirrorTask = async () => {
      await Promise.all(
        mirrors.map(async (mirrorName) => {
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
              await this._updateMirrorStatus(
                primaryFileId,
                mirrorName,
                null,
                'failed',
                error.message
              );
            }
          }
        })
      );
    };

    // 使用 context.waitUntil 确保后台任务完成
    if (this.context && typeof this.context.waitUntil === 'function') {
      this.context.waitUntil(mirrorTask());
    } else {
      // 如果没有 context (如测试环境)，则不等待但捕获错误
      console.warn(
        'RedundancyManager: No context provided for async mirror, task may be cancelled.'
      );
      mirrorTask().catch((err) => console.error('Mirror task failed:', err));
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
      await this.env.DB.prepare(
        `
                INSERT OR REPLACE INTO storage_mirrors (file_id, provider, provider_file_id, status, error, synced_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `
      )
        .bind(fileId, mirrorProvider, mirrorId, status, error, now)
        .run();
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
      )
        .bind(fileId)
        .all();

      return results.map((row) => ({
        provider: row.provider,
        id: row.provider_file_id,
        status: row.status,
        error: row.error,
        syncedAt: row.synced_at,
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
  const { getFallbackChain } = await import('./router.js');

  // 如果未启用回退，使用默认提供者
  if (env.STORAGE_FALLBACK_ENABLED === 'false') {
    const provider = getStorageProvider(env);
    return provider.getFile(fileId, request);
  }

  // 从 D1 获取镜像信息
  let mirrors = [];
  if (env.DB) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM storage_mirrors WHERE file_id = ? AND status = ?'
    )
      .bind(fileId, 'synced')
      .all();
    mirrors = results;
  }

  const chain = getFallbackChain(env, metadata);
  const timeout = parseInt(env.STORAGE_FALLBACK_TIMEOUT || '3000', 10);

  // 构建 provider 列表及其对应的 fileId
  const providers = chain.map((providerName) => {
    let targetFileId = fileId;
    if (metadata?.storage) {
      if (metadata.storage.primary === providerName) {
        targetFileId = metadata.storage.primaryId || fileId;
      } else {
        const mirror = mirrors.find((m) => m.provider === providerName);
        if (mirror?.provider_file_id) {
          targetFileId = mirror.provider_file_id;
        }
      }
    }
    return { name: providerName, fileId: targetFileId };
  });

  // 竞速策略：主存储超时后，同时请求镜像竞速
  if (providers.length === 0) {
    return new Response('File not found in any storage', { status: 404 });
  }

  // 1. 尝试主存储（使用 AbortSignal.timeout 替代手动 setTimeout，避免 Promise 泄漏）
  const primary = providers[0];
  try {
    const provider = getStorageProvider(env, primary.name);
    if (provider) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await provider.getFile(primary.fileId, request, controller.signal);
        if (response.ok) return response;
      } finally {
        clearTimeout(timeoutId);
      }
    }
  } catch (error) {
    console.warn(`Fallback: ${primary.name} failed for ${fileId}:`, error.message);
  }

  // 2. 主存储失败/超时，同时请求所有镜像竞速
  if (providers.length > 1) {
    const rest = providers.slice(1);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const restPromises = rest.map((r) => {
        const p = getStorageProvider(env, r.name);
        return p
          ? p
              .getFile(r.fileId, request, controller.signal)
              .then((res) => (res.ok ? res : Promise.reject(new Error('Not OK'))))
          : Promise.reject(new Error('No provider'));
      });

      const winner = await Promise.race(restPromises);
      if (winner?.ok) return winner;
    } catch {
      // 所有镜像都失败
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return new Response('File not found in any storage', { status: 404 });
}
