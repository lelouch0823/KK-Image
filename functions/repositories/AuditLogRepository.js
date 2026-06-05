/**
 * 审计日志仓库 (Audit Log Repository)
 * =====================================
 * 处理审计日志的查询和导出
 */

const AUDIT_LOG_COLUMNS = `
  id, user_id, actor_type, actor_id, actor_name, actor_role,
  source_app, request_id, trace_id, domain, action, result, severity,
  target_type, target_id, target_label, summary, payload,
  changes_json, metadata_json, ip_address, user_agent, created_at
`;

/**
 * @typedef {Object} AuditLogFilters
 * @property {string} [userId] - 操作用户 ID
 * @property {string} [actorId] - 操作者 ID
 * @property {string} [actorType] - 操作者类型
 * @property {string} [action] - 操作动作
 * @property {string} [domain] - 业务域
 * @property {string} [result] - 操作结果
 * @property {string} [severity] - 严重级别
 * @property {string} [targetType] - 目标类型
 * @property {string} [targetId] - 目标 ID
 * @property {number} [start] - 开始时间戳
 * @property {number} [end] - 结束时间戳
 */

export class AuditLogRepository {
  /**
   * 构造函数
   * @param {D1Database} db - Cloudflare D1 数据库实例
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * 构建过滤条件
   * @param {AuditLogFilters} filters 过滤参数
   * @returns {{ whereClause: string, bindings: unknown[] }}
   */
  _buildFilters(filters = {}) {
    const conditions = [];
    const bindings = [];

    if (filters.userId) {
      conditions.push('user_id = ?');
      bindings.push(filters.userId);
    }
    if (filters.actorId) {
      conditions.push('actor_id = ?');
      bindings.push(filters.actorId);
    }
    if (filters.actorType) {
      conditions.push('actor_type = ?');
      bindings.push(filters.actorType);
    }
    if (filters.action) {
      conditions.push('action = ?');
      bindings.push(filters.action);
    }
    if (filters.domain) {
      conditions.push('domain = ?');
      bindings.push(filters.domain);
    }
    if (filters.result) {
      conditions.push('result = ?');
      bindings.push(filters.result);
    }
    if (filters.severity) {
      conditions.push('severity = ?');
      bindings.push(filters.severity);
    }
    if (filters.targetType) {
      conditions.push('target_type = ?');
      bindings.push(filters.targetType);
    }
    if (filters.targetId) {
      conditions.push('target_id = ?');
      bindings.push(filters.targetId);
    }
    if (filters.start) {
      conditions.push('created_at >= ?');
      bindings.push(Number(filters.start));
    }
    if (filters.end) {
      conditions.push('created_at <= ?');
      bindings.push(Number(filters.end));
    }

    return {
      whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      bindings,
    };
  }

  /**
   * 分页查询审计日志
   * @param {AuditLogFilters} filters 过滤条件
   * @param {{ page: number, pageSize: number }} pagination 分页参数
   * @returns {Promise<{ results: unknown[], total: number }>}
   */
  async list(filters, { page = 1, pageSize = 50 } = {}) {
    const { whereClause, bindings } = this._buildFilters(filters);
    const offset = (page - 1) * pageSize;

    const [countResult, listResult] = await Promise.all([
      this.db
        .prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`)
        .bind(...bindings)
        .first(),
      this.db
        .prepare(
          `SELECT ${AUDIT_LOG_COLUMNS}
           FROM audit_logs ${whereClause}
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        )
        .bind(...bindings, pageSize, offset)
        .all(),
    ]);

    return {
      results: listResult.results || [],
      total: countResult?.total || 0,
    };
  }

  /**
   * 获取所有可用的审计动作类型
   * @returns {Promise<string[]>}
   */
  async getDistinctActions() {
    const { results } = await this.db
      .prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action')
      .all();
    return results.map((r) => r.action);
  }

  /**
   * 导出审计日志（带过滤和数量限制）
   * @param {AuditLogFilters} filters 过滤条件
   * @param {number} limit 最大导出条数
   * @returns {Promise<unknown[]>}
   */
  async export(filters, limit = 5000) {
    const { whereClause, bindings } = this._buildFilters(filters);

    const { results } = await this.db
      .prepare(
        `SELECT ${AUDIT_LOG_COLUMNS}
         FROM audit_logs ${whereClause}
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(...bindings, limit)
      .all();

    return results || [];
  }
}
