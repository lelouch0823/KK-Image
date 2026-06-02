/**
 * ERP 同步服务
 * 编排 ERP 数据同步流程，支持 webhook 回调触发
 *
 * @module services/ErpSyncService
 */
import { ErpAdapterFactory } from './ErpAdapter.js';

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

    const allSuccess = Object.values(results).every(r => r.success !== false);
    const anyFailed = Object.values(results).some(r => r.success === false);
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

    while (hasMore) {
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
          const existingMapping = await this.erpRepo.getMappingByErpId(connection.id, entityType, erpId);
          if (existingMapping) {
            // 已存在映射 -> 更新本地
            await this._updateLocalEntity(entityType, existingMapping.localId, remoteEntity);
            await this.erpRepo.updateSyncLog(logId, { status: 'success', entityId: existingMapping.localId });
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
            await this.erpRepo.updateSyncLog(logId, { status: 'conflict', errorMessage: err.message });
            conflicts++;
          } else {
            await this.erpRepo.updateSyncLog(logId, { status: 'failed', errorMessage: err.message });
            failed++;
          }
        }
      }
      page++;
    }

    return { pulled, failed, conflicts };
  }

  /**
   * 处理 ERP webhook 回调
   * 当 ERP 系统数据变更时推送通知
   * 通过 HMAC-SHA256 签名验证请求合法性
   */
  async handleWebhook(connectionId, rawBody, signature) {
    const connection = await this.erpRepo.getConnectionById(connectionId);
    if (!connection || !connection.enabled) {
      throw new Error('连接不存在或已禁用');
    }

    // 验证 HMAC-SHA256 签名
    const webhookSecret = connection.webhookSecret || connection.config?.webhook_secret;
    if (!webhookSecret) {
      throw new Error('连接未配置 webhook_secret，无法验证签名');
    }
    if (!signature) {
      throw new Error('缺少 X-Webhook-Signature 请求头');
    }
    const expectedSig = await this._computeHmacHex(rawBody, webhookSecret);
    if (!this._timingSafeEqual(expectedSig, signature)) {
      throw new Error('webhook 签名验证失败');
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
            connectionId, entityType: entity_type, localId, erpId: entity_id,
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
   * 计算 HMAC-SHA256（hex 编码）
   */
  async _computeHmacHex(message, secret) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 常数时间字符串比较（防止时序攻击）
   */
  _timingSafeEqual(a, b) {
    const ba = new TextEncoder().encode(a);
    const bb = new TextEncoder().encode(b);
    if (ba.length !== bb.length) return false;
    return crypto.subtle.timingSafeEqual(ba, bb);
  }
}
