import { generatePrefixedId } from '../_shared/utils.js';
import { parseJsonObject } from '../api/utils/json.js';

/**
 * ERP 同步数据访问层
 * @module repositories/ErpSyncRepository
 */
export class ErpSyncRepository {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.idFactory = deps.idFactory || (() => generatePrefixedId('erp_'));
    this.logIdFactory = deps.logIdFactory || (() => generatePrefixedId('erpl_'));
    this.mappingIdFactory = deps.mappingIdFactory || (() => generatePrefixedId('erpm_'));
  }

  // ============================================
  // ERP 连接管理
  // ============================================

  async listConnections() {
    const { results } = await this.db
      .prepare('SELECT * FROM erp_connections ORDER BY created_at DESC')
      .all();
    return (results || []).map(row => this._rowToConnection(row));
  }

  async getConnectionById(id) {
    const row = await this.db
      .prepare('SELECT * FROM erp_connections WHERE id = ?')
      .bind(id)
      .first();
    return row ? this._rowToConnection(row) : null;
  }

  async createConnection({ name, adapterType, baseUrl, authType = 'api_key', credentials = {}, config = {}, syncDirection = 'bidirectional', actorId = null }) {
    const id = this.idFactory();
    const timestamp = this.now();
    await this.db
      .prepare(
        `INSERT INTO erp_connections (id, name, adapter_type, base_url, auth_type, credentials, config, sync_direction, created_by, created_at, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id, name, adapterType, baseUrl, authType,
        JSON.stringify(credentials), JSON.stringify(config), syncDirection,
        actorId, timestamp, actorId, timestamp
      )
      .run();
    return this.getConnectionById(id);
  }

  async updateConnection(id, { name, adapterType, baseUrl, authType, credentials, config, syncDirection, enabled, actorId }) {
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (adapterType !== undefined) { updates.push('adapter_type = ?'); values.push(adapterType); }
    if (baseUrl !== undefined) { updates.push('base_url = ?'); values.push(baseUrl); }
    if (authType !== undefined) { updates.push('auth_type = ?'); values.push(authType); }
    if (credentials !== undefined) { updates.push('credentials = ?'); values.push(JSON.stringify(credentials)); }
    if (config !== undefined) { updates.push('config = ?'); values.push(JSON.stringify(config)); }
    if (syncDirection !== undefined) { updates.push('sync_direction = ?'); values.push(syncDirection); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
    if (updates.length === 0) return this.getConnectionById(id);
    updates.push('updated_by = ?', 'updated_at = ?');
    values.push(actorId, this.now(), id);
    await this.db
      .prepare(`UPDATE erp_connections SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    return this.getConnectionById(id);
  }

  async deleteConnection(id) {
    await this.db.prepare('DELETE FROM erp_connections WHERE id = ?').bind(id).run();
  }

  async updateSyncStatus(id, { status, error = null }) {
    await this.db
      .prepare('UPDATE erp_connections SET last_sync_at = ?, last_sync_status = ?, last_error = ?, updated_at = ? WHERE id = ?')
      .bind(this.now(), status, error, this.now(), id)
      .run();
  }

  // ============================================
  // 同步日志
  // ============================================

  async listSyncLogs({ connectionId, entityType, status, page = 1, limit = 20 } = {}) {
    const conditions = [];
    const params = [];
    if (connectionId) { conditions.push('connection_id = ?'); params.push(connectionId); }
    if (entityType) { conditions.push('entity_type = ?'); params.push(entityType); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countRow = await this.db
      .prepare(`SELECT COUNT(*) as total FROM erp_sync_logs ${where}`)
      .bind(...params)
      .first();

    const { results } = await this.db
      .prepare(`SELECT * FROM erp_sync_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset)
      .all();

    return {
      data: (results || []).map(row => this._rowToSyncLog(row)),
      total: countRow?.total || 0,
      page,
      limit,
    };
  }

  async createSyncLog({ connectionId, entityType, entityId, erpId, direction, action, requestPayload }) {
    const id = this.logIdFactory();
    const timestamp = this.now();
    await this.db
      .prepare(
        `INSERT INTO erp_sync_logs (id, connection_id, entity_type, entity_id, erp_id, direction, action, status, request_payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      )
      .bind(id, connectionId, entityType, entityId || null, erpId || null, direction, action, requestPayload ? JSON.stringify(requestPayload) : null, timestamp)
      .run();
    return id;
  }

  async updateSyncLog(id, { status, responsePayload, errorMessage, completedAt }) {
    const updates = ['status = ?'];
    const values = [status];
    if (responsePayload !== undefined) { updates.push('response_payload = ?'); values.push(JSON.stringify(responsePayload)); }
    if (errorMessage !== undefined) { updates.push('error_message = ?'); values.push(errorMessage); }
    if (completedAt !== undefined) { updates.push('completed_at = ?'); values.push(completedAt); }
    else if (status === 'success' || status === 'failed') { updates.push('completed_at = ?'); values.push(this.now()); }
    values.push(id);
    await this.db
      .prepare(`UPDATE erp_sync_logs SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async incrementRetryCount(id) {
    await this.db
      .prepare('UPDATE erp_sync_logs SET retry_count = retry_count + 1 WHERE id = ?')
      .bind(id)
      .run();
  }

  // ============================================
  // 实体映射
  // ============================================

  async getMapping(connectionId, entityType, localId) {
    const row = await this.db
      .prepare('SELECT * FROM erp_entity_mappings WHERE connection_id = ? AND entity_type = ? AND local_id = ?')
      .bind(connectionId, entityType, localId)
      .first();
    return row ? this._rowToMapping(row) : null;
  }

  async getMappingByErpId(connectionId, entityType, erpId) {
    const row = await this.db
      .prepare('SELECT * FROM erp_entity_mappings WHERE connection_id = ? AND entity_type = ? AND erp_id = ?')
      .bind(connectionId, entityType, erpId)
      .first();
    return row ? this._rowToMapping(row) : null;
  }

  async upsertMapping({ connectionId, entityType, localId, erpId, erpCode }) {
    const timestamp = this.now();
    const existing = await this.getMapping(connectionId, entityType, localId);
    if (existing) {
      await this.db
        .prepare('UPDATE erp_entity_mappings SET erp_id = ?, erp_code = ?, last_synced_at = ?, updated_at = ? WHERE id = ?')
        .bind(erpId, erpCode || null, timestamp, timestamp, existing.id)
        .run();
      return this.getMapping(connectionId, entityType, localId);
    }
    const id = this.mappingIdFactory();
    await this.db
      .prepare(
        `INSERT INTO erp_entity_mappings (id, connection_id, entity_type, local_id, erp_id, erp_code, last_synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, connectionId, entityType, localId, erpId, erpCode || null, timestamp, timestamp, timestamp)
      .run();
    return this.getMapping(connectionId, entityType, localId);
  }

  async listMappings(connectionId, entityType) {
    const { results } = await this.db
      .prepare('SELECT * FROM erp_entity_mappings WHERE connection_id = ? AND entity_type = ? ORDER BY updated_at DESC')
      .bind(connectionId, entityType)
      .all();
    return (results || []).map(row => this._rowToMapping(row));
  }

  // ============================================
  // 同步统计
  // ============================================

  async getSyncStats(connectionId, { since } = {}) {
    const conditions = ['connection_id = ?'];
    const params = [connectionId];
    if (since) { conditions.push('created_at >= ?'); params.push(since); }
    const where = conditions.join(' AND ');
    const { results } = await this.db
      .prepare(
        `SELECT status, COUNT(*) as count FROM erp_sync_logs WHERE ${where} GROUP BY status`
      )
      .bind(...params)
      .all();
    const stats = { total: 0, success: 0, failed: 0, pending: 0, conflict: 0 };
    for (const row of results || []) {
      stats[row.status] = row.count;
      stats.total += row.count;
    }
    return stats;
  }

  // ============================================
  // 内部映射
  // ============================================

  _rowToConnection(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      adapterType: row.adapter_type,
      baseUrl: row.base_url,
      authType: row.auth_type,
      credentials: parseJsonObject(row.credentials, {}),
      config: parseJsonObject(row.config, {}),
      syncDirection: row.sync_direction,
      enabled: Boolean(row.enabled),
      lastSyncAt: row.last_sync_at || null,
      lastSyncStatus: row.last_sync_status || null,
      lastError: row.last_error || null,
      createdBy: row.created_by || null,
      createdAt: row.created_at,
      updatedBy: row.updated_by || null,
      updatedAt: row.updated_at,
    };
  }

  _rowToSyncLog(row) {
    if (!row) return null;
    return {
      id: row.id,
      connectionId: row.connection_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      erpId: row.erp_id,
      direction: row.direction,
      action: row.action,
      status: row.status,
      requestPayload: parseJsonObject(row.request_payload, null),
      responsePayload: parseJsonObject(row.response_payload, null),
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      createdAt: row.created_at,
      completedAt: row.completed_at || null,
    };
  }

  _rowToMapping(row) {
    if (!row) return null;
    return {
      id: row.id,
      connectionId: row.connection_id,
      entityType: row.entity_type,
      localId: row.local_id,
      erpId: row.erp_id,
      erpCode: row.erp_code,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
