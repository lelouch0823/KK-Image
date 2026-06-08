/**
 * ERP 同步服务
 * 编排 ERP 数据同步流程，支持 webhook 回调触发
 *
 * @module services/ErpSyncService
 */
import { ErpAdapterFactory } from './ErpAdapter.js';
import { timingSafeCompare } from '../api/utils/crypto.js';

function createWebhookError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes) {
  const binary = String.fromCharCode(...bytes);
  if (typeof btoa === 'function') return btoa(binary);
  return globalThis.Buffer.from(binary, 'binary').toString('base64');
}

export class ErpSyncService {
  constructor({ erpRepo, productRepo = null, customerRepo = null, orderRepo = null }) {
    this.erpRepo = erpRepo;
    this.productRepo = productRepo;
    this.customerRepo = customerRepo;
    this.orderRepo = orderRepo;
  }

  /**
   * 测试 ERP 连接
   */
  async testConnection(connectionId) {
    const connection = await this.erpRepo.getConnectionById(connectionId);
    if (!connection) throw new Error('连接不存在');
    const adapter = ErpAdapterFactory.create(connection);
    return adapter.testConnection();
  }

  /**
   * 执行全量同步
   * @param {string} connectionId - ERP 连接 ID
   * @param {Object} opts - { entityTypes, direction }
   */
  async syncAll(connectionId, { entityTypes = ['product', 'customer', 'order'], direction } = {}) {
    const connection = await this.erpRepo.getConnectionById(connectionId);
    if (!connection) throw new Error('连接不存在');
    if (!connection.enabled) throw new Error('连接已禁用');

    const syncDirection = direction || connection.syncDirection;
    const results = {};

    for (const entityType of entityTypes) {
      try {
        results[entityType] = await this._syncEntity(connection, entityType, syncDirection);
      } catch (err) {
        results[entityType] = { success: false, error: err.message };
      }
    }

    const allSuccess = Object.values(results).every((r) => r.success !== false);
    const anyFailed = Object.values(results).some((r) => r.success === false);
    const status = allSuccess ? 'success' : anyFailed ? 'failed' : 'partial';
    await this.erpRepo.updateSyncStatus(connectionId, { status });

    return { status, results };
  }

  /**
   * 同步单个实体
   */
  async _syncEntity(connection, entityType, direction) {
    const adapter = ErpAdapterFactory.create(connection);
    const stats = { pushed: 0, pulled: 0, failed: 0, conflicts: 0 };

    if (direction === 'push' || direction === 'bidirectional') {
      const pushResult = await this._pushEntities(connection, adapter, entityType);
      stats.pushed = pushResult.pushed;
      stats.failed += pushResult.failed;
    }

    if (direction === 'pull' || direction === 'bidirectional') {
      const pullResult = await this._pullEntities(connection, adapter, entityType);
      stats.pulled = pullResult.pulled;
      stats.failed += pullResult.failed;
      stats.conflicts = pullResult.conflicts;
    }

    return { success: true, stats };
  }

  /**
   * 推送本地数据到 ERP
   */
  async _pushEntities(connection, adapter, entityType) {
    const entities = await this._getLocalEntities(entityType);
    let pushed = 0;
    let failed = 0;

    for (const entity of entities) {
      const logId = await this.erpRepo.createSyncLog({
        connectionId: connection.id,
        entityType,
        entityId: entity.id,
        direction: 'push',
        action: 'update',
        requestPayload: entity,
      });

      try {
        const pushMethod = this._getPushMethod(adapter, entityType);
        const result = await pushMethod(entity);

        await this.erpRepo.upsertMapping({
          connectionId: connection.id,
          entityType,
          localId: entity.id,
          erpId: result.erpId,
          erpCode: result.erpCode,
        });

        await this.erpRepo.updateSyncLog(logId, {
          status: 'success',
          responsePayload: result.data,
        });
        pushed++;
      } catch (err) {
        console.error(`[ErpSync] push ${entityType} ${entity.id} failed:`, err.message);
        await this.erpRepo.updateSyncLog(logId, {
          status: 'failed',
          errorMessage: err.message,
        });
        failed++;
      }
    }

    return { pushed, failed };
  }

  /**
   * 从 ERP 拉取数据
   */
  async _pullEntities(connection, adapter, entityType) {
    let pulled = 0;
    let failed = 0;
    let conflicts = 0;
    let page = 1;
    let hasMore = true;
    let truncated = false;
    const maxPages = Math.max(1, Number(connection.config?.maxPages || connection.config?.max_pages || 100));

    while (hasMore && page <= maxPages) {
      const { items, hasMore: more } = await adapter.listRemote(entityType, { limit: 50, page });
      hasMore = more;

      for (const remoteEntity of items) {
        const erpId = String(remoteEntity.id || remoteEntity.erp_id);
        const logId = await this.erpRepo.createSyncLog({
          connectionId: connection.id,
          entityType,
          erpId,
          direction: 'pull',
          action: 'update',
          requestPayload: remoteEntity,
        });

        try {
          const existingMapping = await this.erpRepo.getMappingByErpId(
            connection.id,
            entityType,
            erpId
          );
          if (existingMapping) {
            // 已存在映射 -> 更新本地
            await this._updateLocalEntity(entityType, existingMapping.localId, remoteEntity);
            await this.erpRepo.updateSyncLog(logId, {
              status: 'success',
              entityId: existingMapping.localId,
            });
            pulled++;
          } else {
            // 新实体 -> 创建本地
            const localId = await this._createLocalEntity(entityType, remoteEntity);
            await this.erpRepo.upsertMapping({
              connectionId: connection.id,
              entityType,
              localId,
              erpId,
              erpCode: remoteEntity.code,
            });
            await this.erpRepo.updateSyncLog(logId, { status: 'success', entityId: localId });
            pulled++;
          }
        } catch (err) {
          if (err.message.includes('conflict')) {
            console.warn(`[ErpSync] pull ${entityType} ${erpId} conflict:`, err.message);
            await this.erpRepo.updateSyncLog(logId, {
              status: 'conflict',
              errorMessage: err.message,
            });
            conflicts++;
          } else {
            console.error(`[ErpSync] pull ${entityType} ${erpId} failed:`, err.message);
            await this.erpRepo.updateSyncLog(logId, {
              status: 'failed',
              errorMessage: err.message,
            });
            failed++;
          }
        }
      }
      page++;
    }

    if (hasMore) {
      truncated = true;
    }

    return { pulled, failed, conflicts, truncated };
  }

  /**
   * 处理 ERP webhook 回调
   * 当 ERP 系统数据变更时推送通知
   * 通过 HMAC-SHA256 签名验证请求合法性
   */
  async handleWebhook(connectionId, rawBody, signature) {
    const connection = await this.erpRepo.getConnectionById(connectionId);
    if (!connection || !connection.enabled) {
      throw createWebhookError('连接不存在或已禁用', 404);
    }

    // 验证 HMAC-SHA256 签名
    const webhookSecret = connection.webhookSecret || connection.config?.webhook_secret;
    if (!webhookSecret) {
      throw createWebhookError('连接未配置 webhook_secret，无法验证签名', 500);
    }
    if (!signature) {
      throw createWebhookError('缺少 X-Webhook-Signature 请求头', 401);
    }
    if (!(await this._verifyWebhookSignature(rawBody, webhookSecret, signature))) {
      throw createWebhookError('webhook 签名验证失败', 401);
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error('webhook 请求体不是有效的 JSON');
    }

    const { entity_type, entity_id, action, data } = payload;
    if (!entity_type || !entity_id) {
      throw new Error('缺少必要字段: entity_type, entity_id');
    }

    const logId = await this.erpRepo.createSyncLog({
      connectionId,
      entityType: entity_type,
      erpId: entity_id,
      direction: 'pull',
      action: action || 'update',
      requestPayload: payload,
    });

    try {
      if (action === 'delete') {
        const mapping = await this.erpRepo.getMappingByErpId(connection.id, entity_type, entity_id);
        if (mapping) {
          await this._deleteLocalEntity(entity_type, mapping.localId);
        }
        await this.erpRepo.updateSyncLog(logId, { status: 'success' });
      } else {
        const mapping = await this.erpRepo.getMappingByErpId(connection.id, entity_type, entity_id);
        if (mapping) {
          await this._updateLocalEntity(entity_type, mapping.localId, data);
          await this.erpRepo.updateSyncLog(logId, { status: 'success', entityId: mapping.localId });
        } else {
          const localId = await this._createLocalEntity(entity_type, data);
          await this.erpRepo.upsertMapping({
            connectionId,
            entityType: entity_type,
            localId,
            erpId: entity_id,
          });
          await this.erpRepo.updateSyncLog(logId, { status: 'success', entityId: localId });
        }
      }
      return { success: true };
    } catch (err) {
      await this.erpRepo.updateSyncLog(logId, { status: 'failed', errorMessage: err.message });
      throw err;
    }
  }

  _getPushMethod(adapter, entityType) {
    const methods = {
      product: (e) => adapter.pushProduct(e),
      customer: (e) => adapter.pushCustomer(e),
      order: (e) => adapter.pushOrder(e),
    };
    return methods[entityType];
  }

  async _getLocalEntities(entityType) {
    const limit = 100;
    if (entityType === 'product') {
      if (!this.productRepo) throw new Error('productRepo 未注入，无法同步商品');
      const result = await this.productRepo.search({ limit, page: 1, status: 'active' });
      return result.data || [];
    }
    if (entityType === 'customer') {
      if (!this.customerRepo) throw new Error('customerRepo 未注入，无法同步客户');
      return this.customerRepo.listAll ? await this.customerRepo.listAll({ limit }) : [];
    }
    if (entityType === 'order') {
      if (!this.orderRepo) throw new Error('orderRepo 未注入，无法同步订单');
      return this.orderRepo.listRecent ? await this.orderRepo.listRecent(limit) : [];
    }
    return [];
  }

  async _createLocalEntity(entityType, _data) {
    // 根据实体类型创建本地记录
    // 实际实现取决于各 Repository 的接口
    throw new Error(`创建本地 ${entityType} 需要具体实现`);
  }

  async _updateLocalEntity(entityType, localId, _data) {
    throw new Error(`更新本地 ${entityType} (ID: ${localId}) 需要具体实现`);
  }

  async _deleteLocalEntity(entityType, localId) {
    throw new Error(`删除本地 ${entityType} (ID: ${localId}) 需要具体实现`);
  }

  /**
   * 计算 HMAC-SHA256 原始字节
   */
  async _computeHmacBytes(message, secret) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return new Uint8Array(sig);
  }

  /**
   * 计算 HMAC-SHA256（hex 编码）
   */
  async _computeHmacHex(message, secret) {
    return bytesToHex(await this._computeHmacBytes(message, secret));
  }

  /**
   * 计算 HMAC-SHA256（base64 编码）
   */
  async _computeHmacBase64(message, secret) {
    return bytesToBase64(await this._computeHmacBytes(message, secret));
  }

  async _verifyWebhookSignature(message, secret, signature) {
    const supplied = String(signature || '').trim();
    if (!supplied) return false;

    const expectedHex = await this._computeHmacHex(message, secret);
    const expectedBase64 = await this._computeHmacBase64(message, secret);
    if (supplied.toLowerCase().startsWith('sha256=')) {
      const value = supplied.slice('sha256='.length).trim();
      if (/^[a-f0-9]{64}$/i.test(value)) {
        return this._timingSafeEqual(expectedHex, value.toLowerCase());
      }
      return this._timingSafeEqual(expectedBase64, value);
    }

    if (/^[a-f0-9]{64}$/i.test(supplied)) {
      return this._timingSafeEqual(expectedHex, supplied.toLowerCase());
    }

    return false;
  }

  /**
   * 常数时间字符串比较（防止时序攻击）
   */
  _timingSafeEqual(a, b) {
    return timingSafeCompare(a, b);
  }
}
