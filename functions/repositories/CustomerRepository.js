import { parseRepoPagination } from '../api/utils/pagination.js';
import { safeJsonParse } from '../api/utils/json.js';
import { hasChanges } from '../api/utils/result.js';
import { buildSetClause } from '../api/utils/sql.js';

/**
 * 客户仓库
 * 处理客户的 CRUD 和数据转换
 */
export class CustomerRepository {
  /** @type {boolean|null} FTS5 可用性缓存 */
  static _ftsAvailable = null;

  constructor(db) {
    this.db = db;
  }

  /**
   * 检查 FTS5 虚拟表是否存在（带模块级缓存）
   * @returns {Promise<boolean>}
   */
  async _hasFtsTable() {
    if (CustomerRepository._ftsAvailable !== null) return CustomerRepository._ftsAvailable;
    try {
      const stmt = this.db.prepare?.("SELECT name FROM sqlite_master WHERE type='table' AND name='customers_fts'");
      if (!stmt) { CustomerRepository._ftsAvailable = false; return false; }
      const result = await stmt.first();
      CustomerRepository._ftsAvailable = !!result;
    } catch {
      CustomerRepository._ftsAvailable = false;
    }
    return CustomerRepository._ftsAvailable;
  }

  /**
   * 根据 ID 查找客户
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const customer = await this.db
      .prepare(
        `
            SELECT * FROM customers WHERE id = ?
        `
      )
      .bind(id)
      .first();

    if (customer) {
      if (customer.tags) {
        const parsedTags = safeJsonParse(customer.tags, customer.tags);
        if (Array.isArray(parsedTags)) {
          customer.tags = parsedTags;
        } else if (parsedTags !== null && parsedTags !== undefined && parsedTags !== '') {
          customer.tags = [parsedTags];
        } else {
          customer.tags = [];
        }
      } else {
        customer.tags = [];
      }
    }
    return customer;
  }

  /**
   * 获取客户列表 (分页)
   * @param {Object} params
   * @param {number} params.page
   * @param {number} params.limit
   * @param {string} [params.search]
   * @returns {Promise<{results: Array, total: number, pages: number}>}
   */
  async list({ page = 1, limit = 20, search = '' }) {
    const { limit: safeLimit, offset } = parseRepoPagination(
      { page, limit },
      { defaultPage: 1, defaultLimit: 20, maxLimit: 100 }
    );

    let whereClause = '1=1';
    const bindings = [];

    if (search) {
      // 优先使用 FTS5 全文搜索（O(logN)），不可用时降级为 LIKE（O(N)）
      const hasFts = await this._hasFtsTable();
      if (hasFts) {
        const ftsQuery = `"${search.replace(/"/g, '""')}"*`;
        whereClause += ` AND rowid IN (SELECT rowid FROM customers_fts WHERE customers_fts MATCH ?)`;
        bindings.push(ftsQuery);
      } else {
        whereClause += ' AND (name LIKE ? OR phone LIKE ? OR company LIKE ?)';
        const term = `%${search}%`;
        bindings.push(term, term, term);
      }
    }

    const [countResult, listResult] = await Promise.all([
      this.db
        .prepare(
          `
                SELECT COUNT(*) as total FROM customers WHERE ${whereClause}
            `
        )
        .bind(...bindings)
        .first(),
      this.db
        .prepare(
          `
                SELECT * FROM customers
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `
        )
        .bind(...bindings, safeLimit, offset)
        .all(),
    ]);

    const results = listResult.results.map((c) => {
      let tags = [];
      if (c.tags) {
        const parsedTags = safeJsonParse(c.tags, c.tags);
        if (Array.isArray(parsedTags)) {
          tags = parsedTags;
        } else if (parsedTags !== null && parsedTags !== undefined && parsedTags !== '') {
          tags = [parsedTags];
        }
      }
      return { ...c, tags };
    });

    return {
      results,
      total: countResult.total,
      pages: Math.ceil(countResult.total / safeLimit),
    };
  }

  /**
   * 创建客户
   * @param {Object} data
   * @param {string} data.name
   * @param {string} [data.phone]
   * @param {string} [data.company]
   * @param {string} [data.email]
   * @param {string} [data.address]
   * @param {Array} [data.tags]
   * @param {string} [data.remark]
   * @param {string} [data.createdBy]
   * @returns {Promise<Object>} Created customer
   */
  async create(data) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const tags = data.tags ? JSON.stringify(data.tags) : '[]';

    await this.db
      .prepare(
        `
            INSERT INTO customers (id, name, phone, company, email, address, tags, remark, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        id,
        data.name,
        data.phone || '',
        data.company || '',
        data.email || '',
        data.address || '',
        tags,
        data.remark || '',
        data.createdBy || 'admin',
        now,
        now
      )
      .run();

    return {
      id,
      ...data,
      tags: data.tags || [],
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * 更新客户信息
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<boolean>}
   */
  async update(id, data) {
    const updateData = {};

    const fields = ['name', 'phone', 'company', 'email', 'address', 'remark'];
    fields.forEach((field) => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    if (data.tags !== undefined) {
      updateData.tags = JSON.stringify(data.tags);
    }

    if (Object.keys(updateData).length === 0) return false;

    updateData.updated_at = Date.now();
    const { clause, values } = buildSetClause(updateData);

    const result = await this.db
      .prepare(
        `
            UPDATE customers SET ${clause} WHERE id = ?
        `
      )
      .bind(...values, id)
      .run();

    if (hasChanges(result)) return true;
    const existing = await this.db.prepare('SELECT id FROM customers WHERE id = ?').bind(id).first();
    return Boolean(existing);
  }

  /**
   * 删除客户
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const result = await this.db
      .prepare(
        `
            DELETE FROM customers WHERE id = ?
        `
      )
      .bind(id)
      .run();
    return hasChanges(result);
  }

  /**
   * 检查是否有关联订单
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async hasOrders(id) {
    const result = await this.db
      .prepare(
        `
            SELECT COUNT(*) as count FROM orders WHERE customer_id = ?
        `
      )
      .bind(id)
      .first();
    return result.count > 0;
  }
}
