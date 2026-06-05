import { parseRepoPagination } from '../api/utils/pagination.js';
import { safeJsonParse } from '../api/utils/json.js';
import { hasChanges } from '../api/utils/result.js';
import { buildSetClause } from '../api/utils/sql.js';
import { checkFtsTable, sanitizeFts5Query } from '../api/utils/fts.js';
import type { D1Database, D1Result } from '../types/database.js';
import type {
  Customer,
  CreateCustomerData,
  UpdateCustomerData,
  CustomerSuggestion,
  CustomerOrderStats,
  RfmSegment,
  RfmSegmentData,
  CustomerTag,
  Communication,
  CommunicationType,
  FavoriteProduct,
  PaginatedResult,
} from '../types/entities.js';

/**
 * 客户仓库
 * 处理客户的 CRUD 和数据转换
 */
/**
 * 根据订单数和最近下单天数判断 RFM 分段
 */
function classifyRfmSegment(orderCount: number, recencyDays: number | null): RfmSegment {
  if (orderCount === 0) return 'new';
  if (recencyDays! <= 90 && orderCount >= 5) return 'vip';
  if (recencyDays! <= 90) return 'active';
  if (recencyDays! <= 180) return 'at-risk';
  return 'lost';
}

export class CustomerRepository {
  protected db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * 批量根据 ID 查找客户
   * @param ids 客户 ID 列表
   * @returns 客户列表（仅返回存在的记录）
   */
  async findByIds(ids: string[]): Promise<Customer[]> {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await this.db
      .prepare(`SELECT * FROM customers WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all<Customer>();

    return results.map((customer) => {
      if (customer.tags) {
        const parsedTags = safeJsonParse(customer.tags as unknown as string, customer.tags);
        if (Array.isArray(parsedTags)) {
          (customer as Record<string, unknown>).tags = parsedTags;
        } else if (parsedTags !== null && parsedTags !== undefined && parsedTags !== '') {
          (customer as Record<string, unknown>).tags = [parsedTags];
        } else {
          (customer as Record<string, unknown>).tags = [];
        }
      } else {
        (customer as Record<string, unknown>).tags = [];
      }
      return customer;
    });
  }

  /**
   * 根据 ID 查找客户
   * @param id 客户 ID
   * @returns 客户对象，不存在时返回 null
   */
  async findById(id: string): Promise<Customer | null> {
    const customer = await this.db
      .prepare(
        `
            SELECT * FROM customers WHERE id = ?
        `
      )
      .bind(id)
      .first<Customer>();

    if (customer) {
      if (customer.tags) {
        const parsedTags = safeJsonParse(customer.tags as unknown as string, customer.tags);
        if (Array.isArray(parsedTags)) {
          (customer as Record<string, unknown>).tags = parsedTags;
        } else if (parsedTags !== null && parsedTags !== undefined && parsedTags !== '') {
          (customer as Record<string, unknown>).tags = [parsedTags];
        } else {
          (customer as Record<string, unknown>).tags = [];
        }
      } else {
        (customer as Record<string, unknown>).tags = [];
      }
    }
    return customer;
  }

  /**
   * 获取客户列表 (分页)
   * @param params 分页和搜索参数
   * @returns 分页结果
   */
  async list({ page = 1, limit = 20, search = '' }: { page?: number; limit?: number; search?: string }): Promise<PaginatedResult<Customer>> {
    const { limit: safeLimit, offset } = parseRepoPagination(
      { page, limit },
      { defaultPage: 1, defaultLimit: 20, maxLimit: 100 }
    );

    let whereClause = '1=1';
    const bindings: unknown[] = [];

    if (search) {
      // 优先使用 FTS5 全文搜索（O(logN)），不可用时降级为 LIKE（O(N)）
      const hasFts = await checkFtsTable(this.db, 'customers_fts');
      if (hasFts) {
        const sanitized = sanitizeFts5Query(search);
        if (sanitized) {
          whereClause += ` AND rowid IN (SELECT rowid FROM customers_fts WHERE customers_fts MATCH ?)`;
          bindings.push(`"${sanitized}"*`);
        }
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
        .first<{ total: number }>(),
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
        .all<Customer>(),
    ]);

    const results = listResult.results.map((c) => {
      let tags: string[] = [];
      if (c.tags) {
        const parsedTags = safeJsonParse(c.tags as unknown as string, c.tags);
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
      total: countResult!.total,
      pages: Math.ceil(countResult!.total / safeLimit),
    };
  }

  /**
   * 客户名称/手机搜索建议（轻量级，仅返回必要字段）
   * @param query 搜索关键词
   * @param limit 最大返回条数
   * @returns 客户建议列表
   */
  async suggest(query: string, limit: number = 10): Promise<CustomerSuggestion[]> {
    if (!query || !query.trim()) return [];
    const term = `%${query.trim()}%`;
    const { results } = await this.db.prepare(
      `SELECT id, name, phone, company FROM customers
       WHERE name LIKE ? OR phone LIKE ? OR company LIKE ?
       ORDER BY name ASC LIMIT ?`
    ).bind(term, term, term, limit).all<CustomerSuggestion>();
    return results;
  }

  /**
   * 创建客户
   * @param data 客户数据
   * @returns 创建的客户对象
   */
  async create(data: CreateCustomerData): Promise<Customer> {
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
    } as Customer;
  }

  /**
   * 更新客户信息
   * @param id 客户 ID
   * @param data 更新数据
   * @returns 是否成功更新
   */
  async update(id: string, data: UpdateCustomerData): Promise<boolean> {
    const updateData: Record<string, unknown> = {};

    const fields: Array<keyof UpdateCustomerData> = ['name', 'phone', 'company', 'email', 'address', 'remark'];
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
    const existing = await this.db.prepare('SELECT id FROM customers WHERE id = ?').bind(id).first<{ id: string }>();
    return Boolean(existing);
  }

  /**
   * 删除客户
   * @param id 客户 ID
   * @returns 是否成功删除
   */
  async delete(id: string): Promise<boolean> {
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
   * @param id 客户 ID
   * @returns 是否有订单
   */
  async hasOrders(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        `
            SELECT COUNT(*) as count FROM orders WHERE customer_id = ?
        `
      )
      .bind(id)
      .first<{ count: number }>();
    return result!.count > 0;
  }

  /**
   * 获取客户订单统计
   * @param id 客户 ID
   * @returns 订单统计数据
   */
  async getOrderStats(id: string): Promise<CustomerOrderStats> {
    const stats = await this.db
      .prepare(
        `
          SELECT
            COUNT(o.id) AS order_count,
            MIN(o.created_at) AS first_order_at,
            MAX(o.created_at) AS last_order_at
          FROM orders o
          WHERE o.customer_id = ?
        `
      )
      .bind(id)
      .first<{ order_count: number; first_order_at: number | null; last_order_at: number | null }>();

    const now = Date.now();
    const lastOrderAt = stats!.last_order_at || null;
    const recencyDays = lastOrderAt ? Math.floor((now - lastOrderAt) / (24 * 60 * 60 * 1000)) : null;

    return {
      orderCount: stats!.order_count || 0,
      firstOrderAt: stats!.first_order_at || null,
      lastOrderAt: lastOrderAt,
      recencyDays,
    };
  }

  /**
   * 获取客户最常订购的商品
   * @param id 客户 ID
   * @param limit 返回数量限制
   * @returns 常用商品列表
   */
  async getFavoriteProducts(id: string, limit: number = 5): Promise<FavoriteProduct[]> {
    const { results } = await this.db
      .prepare(
        `
          SELECT
            o.product_id,
            o.summary_name AS product_name,
            COUNT(*) AS order_count
          FROM orders o
          WHERE o.customer_id = ? AND o.product_id IS NOT NULL
          GROUP BY o.product_id
          ORDER BY order_count DESC
          LIMIT ?
        `
      )
      .bind(id, limit)
      .all<{ product_id: string; product_name: string; order_count: number }>();

    return results.map((r) => ({
      productId: r.product_id,
      productName: r.product_name || '',
      orderCount: r.order_count,
    }));
  }

  /**
   * RFM 分段：根据客户订单数据自动分类
   * @param id 客户 ID
   * @returns RFM 数据和分段标签
   */
  async getRfmSegment(id: string): Promise<RfmSegmentData> {
    const stats = await this.getOrderStats(id);
    const { orderCount, recencyDays } = stats;
    const segment = classifyRfmSegment(orderCount, recencyDays);

    return {
      ...stats,
      segment,
    };
  }

  /**
   * 批量获取多个客户的 RFM 分段（用于列表展示）
   * @param ids 客户 ID 列表
   * @returns 客户 ID 到 RFM 数据的映射
   */
  async getBatchRfmSegments(ids: string[]): Promise<Map<string, RfmSegmentData>> {
    if (!ids.length) return new Map();

    const placeholders = ids.map(() => '?').join(',');
    const { results } = await this.db
      .prepare(
        `
          SELECT
            c.id AS customer_id,
            COUNT(o.id) AS order_count,
            MAX(o.created_at) AS last_order_at
          FROM customers c
          LEFT JOIN orders o ON o.customer_id = c.id
          WHERE c.id IN (${placeholders})
          GROUP BY c.id
        `
      )
      .bind(...ids)
      .all<{ customer_id: string; order_count: number; last_order_at: number | null }>();

    const now = Date.now();
    const segmentMap = new Map<string, RfmSegmentData>();

    for (const row of results) {
      const orderCount = row.order_count || 0;
      const lastOrderAt = row.last_order_at || null;
      const recencyDays = lastOrderAt ? Math.floor((now - lastOrderAt) / (24 * 60 * 60 * 1000)) : null;
      const segment = classifyRfmSegment(orderCount, recencyDays);

      segmentMap.set(row.customer_id, { segment, orderCount, lastOrderAt, recencyDays });
    }

    // 确保所有请求的 ID 都有结果
    for (const id of ids) {
      if (!segmentMap.has(id)) {
        segmentMap.set(id, { segment: 'new', orderCount: 0, lastOrderAt: null, recencyDays: null });
      }
    }

    return segmentMap;
  }

  // ========================================
  // 标签管理 (Tags CRUD)
  // ========================================

  /**
   * 获取客户的所有标签
   * @param customerId 客户 ID
   * @returns 标签列表
   */
  async getTags(customerId: string): Promise<CustomerTag[]> {
    const { results } = await this.db
      .prepare(
        'SELECT id, tag_name, created_at FROM customer_tags WHERE customer_id = ? ORDER BY created_at DESC'
      )
      .bind(customerId)
      .all<{ id: number; tag_name: string; created_at: number }>();
    return results.map((r) => ({ id: r.id, name: r.tag_name, createdAt: r.created_at }));
  }

  /**
   * 添加标签
   * @param customerId 客户 ID
   * @param tagName 标签名称
   * @returns 新标签，已存在时返回 null
   */
  async addTag(customerId: string, tagName: string): Promise<{ customer_id: string; tag_name: string; created_at: number } | null> {
    const now = Date.now();
    try {
      await this.db
        .prepare(
          'INSERT INTO customer_tags (customer_id, tag_name, created_at) VALUES (?, ?, ?)'
        )
        .bind(customerId, tagName, now)
        .run();
      return { customer_id: customerId, tag_name: tagName, created_at: now };
    } catch (e) {
      // UNIQUE 约束冲突 → 标签已存在，忽略
      if (e instanceof Error && e.message?.includes('UNIQUE')) return null;
      throw e;
    }
  }

  /**
   * 删除标签
   * @param customerId 客户 ID
   * @param tagName 标签名称
   * @returns 是否成功删除
   */
  async removeTag(customerId: string, tagName: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM customer_tags WHERE customer_id = ? AND tag_name = ?')
      .bind(customerId, tagName)
      .run();
    return result.meta.changes > 0;
  }

  /**
   * 获取所有客户使用过的标签列表（去重）
   * @returns 标签列表（含使用次数）
   */
  async getAllTags(): Promise<Array<{ name: string; usageCount: number }>> {
    const { results } = await this.db
      .prepare(
        'SELECT DISTINCT tag_name, COUNT(*) as usage_count FROM customer_tags GROUP BY tag_name ORDER BY usage_count DESC'
      )
      .all<{ tag_name: string; usage_count: number }>();
    return results.map((r) => ({ name: r.tag_name, usageCount: r.usage_count }));
  }

  // ========================================
  // 沟通记录 (Communications)
  // ========================================

  /**
   * 获取客户沟通记录（分页）
   * @param customerId 客户 ID
   * @param params 分页参数
   * @returns 分页结果
   */
  async getCommunications(customerId: string, { page = 1, limit = 20 }: { page?: number; limit?: number } = {}): Promise<{ results: Communication[]; total: number }> {
    const { limit: safeLimit, offset } = parseRepoPagination(
      { page, limit },
      { defaultPage: 1, defaultLimit: 20, maxLimit: 100 }
    );

    const [countResult, listResult] = await Promise.all([
      this.db
        .prepare('SELECT COUNT(*) as total FROM customer_communications WHERE customer_id = ?')
        .bind(customerId)
        .first<{ total: number }>(),
      this.db
        .prepare(
          'SELECT * FROM customer_communications WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        )
        .bind(customerId, safeLimit, offset)
        .all<Communication>(),
    ]);

    return {
      results: listResult.results,
      total: countResult!.total,
    };
  }

  /**
   * 添加沟通记录
   * @param customerId 客户 ID
   * @param type 记录类型
   * @param content 记录内容
   * @param createdBy 创建人
   * @returns 新记录
   */
  async addCommunication(customerId: string, type: CommunicationType, content: string, createdBy?: string): Promise<Communication> {
    const id = crypto.randomUUID();
    const now = Date.now();

    await this.db
      .prepare(
        'INSERT INTO customer_communications (id, customer_id, type, content, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(id, customerId, type, content, now, createdBy || null)
      .run();

    return { id, customer_id: customerId, type, content, created_at: now, created_by: createdBy || null };
  }

  /**
   * 删除沟通记录
   * @param id 记录 ID
   * @returns 是否成功删除
   */
  async deleteCommunication(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM customer_communications WHERE id = ?')
      .bind(id)
      .run();
    return hasChanges(result);
  }
}
