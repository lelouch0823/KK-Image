import { generateId, generateShareToken, hashPassword, now } from '../api/utils/id.js';
import { parseRepoPagination } from '../api/utils/pagination.js';
import { hasChanges } from '../api/utils/result.js';
import { buildSetClause } from '../api/utils/sql.js';

/**
 * 销售人员仓库
 * 处理销售人员的 CRUD、鉴权和密码管理
 */
export class SalespersonRepository {
  constructor(db, jwtSecret) {
    this.db = db;
    this.jwtSecret = jwtSecret; // 需要传入 JWT_SECRET 用于密码哈希
  }

  /**
   * 根据 ID 查找销售人员
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    return await this.db
      .prepare(
        `
            SELECT * FROM salespersons WHERE id = ?
        `
      )
      .bind(id)
      .first();
  }

  /**
   * 根据 AccessToken 查找销售人员
   * @param {string} token
   * @returns {Promise<Object|null>}
   */
  async findByToken(token) {
    return await this.db
      .prepare(
        `
            SELECT * FROM salespersons WHERE access_token = ?
        `
      )
      .bind(token)
      .first();
  }

  /**
   * 根据微信 OpenID 查找销售人员
   * @param {string} openid
   * @returns {Promise<Object|null>}
   */
  async findByWechatOpenid(openid) {
    return await this.db
      .prepare('SELECT * FROM salespersons WHERE wechat_openid = ?')
      .bind(openid)
      .first();
  }

  /**
   * 绑定微信 OpenID 到销售人员
   * @param {string} id - 销售人员 ID
   * @param {string} openid - 微信 OpenID
   * @returns {Promise<boolean>}
   */
  async updateWechatOpenid(id, openid) {
    const result = await this.db
      .prepare('UPDATE salespersons SET wechat_openid = ?, updated_at = ? WHERE id = ?')
      .bind(openid, now(), id)
      .run();
    return hasChanges(result);
  }

  /**
   * 获取销售人员列表 (分页)
   * @param {Object} params
   * @param {number} params.page
   * @param {number} params.limit
   * @param {string} [params.search]
   * @returns {Promise<{results: Array, total: number, pages: number}>}
   */
  async list({ page = 1, limit = 50, search = '' }) {
    const { limit: safeLimit, offset } = parseRepoPagination(
      { page, limit },
      { defaultPage: 1, defaultLimit: 50, maxLimit: 100 }
    );

    let whereClause = '1=1';
    const bindings = [];

    if (search) {
      whereClause += ' AND (s.name LIKE ? OR s.store LIKE ? OR s.phone LIKE ?)';
      const term = `%${search}%`;
      bindings.push(term, term, term);
    }

    const [countResult, listResult] = await Promise.all([
      this.db
        .prepare(
          `
                SELECT COUNT(*) as total FROM salespersons s WHERE ${whereClause}
            `
        )
        .bind(...bindings)
        .first(),
      this.db
        .prepare(
          `
                SELECT
                    s.*,
                    COALESCE(oc.order_count, 0) as order_count
                FROM salespersons s
                LEFT JOIN (
                    SELECT salesperson_id, COUNT(*) as order_count
                    FROM orders
                    GROUP BY salesperson_id
                ) oc ON oc.salesperson_id = s.id
                WHERE ${whereClause}
                ORDER BY s.created_at DESC
                LIMIT ? OFFSET ?
            `
        )
        .bind(...bindings, safeLimit, offset)
        .all(),
    ]);

    return {
      results: listResult.results,
      total: countResult.total,
      pages: Math.ceil(countResult.total / safeLimit),
    };
  }

  /**
   * 创建销售人员
   * @param {Object} data
   * @param {string} data.name
   * @param {string} [data.store]
   * @param {string} [data.phone]
   * @param {string} data.password
   * @returns {Promise<Object>} Created salesperson
   */
  async create({ name, store, phone, password }) {
    const id = generateId();
    const accessToken = generateShareToken(12);
    const passwordHash = await hashPassword(password, this.jwtSecret);
    const timestamp = now();

    let retries = 3;
    while (retries > 0) {
      try {
        await this.db
          .prepare(
            `
                    INSERT INTO salespersons (id, name, store, phone, access_token, password_hash, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                `
          )
          .bind(
            id,
            name.trim(),
            store || null,
            phone || null,
            accessToken,
            passwordHash,
            timestamp,
            timestamp
          )
          .run();
        break;
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed') && retries > 1) {
          retries--;
          continue;
        }
        throw e;
      }
    }

    return {
      id,
      name: name.trim(),
      store,
      phone,
      accessToken,
      accessUrl: `/order/${accessToken}`,
    };
  }

  /**
   * 更新销售人员信息
   * @param {string} id
   * @param {Object} data
   * @returns {Promise<boolean>}
   */
  async update(id, data) {
    const updateData = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.store !== undefined) {
      updateData.store = data.store || null;
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone || null;
    }
    if (data.password) {
      const passwordHash = await hashPassword(data.password, this.jwtSecret);
      updateData.password_hash = passwordHash;
    }
    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive ? 1 : 0;
    }

    if (Object.keys(updateData).length === 0) return false;

    updateData.updated_at = now();
    const { clause, values } = buildSetClause(updateData);

    const result = await this.db
      .prepare(
        `
            UPDATE salespersons SET ${clause} WHERE id = ?
        `
      )
      .bind(...values, id)
      .run();

    return hasChanges(result);
  }

  /**
   * 删除销售人员
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const result = await this.db
      .prepare(
        `
            DELETE FROM salespersons WHERE id = ?
        `
      )
      .bind(id)
      .run();
    return hasChanges(result);
  }

  /**
   * 重置 Token
   * @param {string} id
   * @returns {Promise<string>} New token
   */
  async resetAccessToken(id) {
    const newToken = generateShareToken(12);
    const result = await this.db
      .prepare(
        `
            UPDATE salespersons SET access_token = ?, updated_at = ? WHERE id = ?
        `
      )
      .bind(newToken, now(), id)
      .run();

    if (!hasChanges(result)) throw new Error('Salesperson not found');
    return newToken;
  }

  /**
   * 验证该用户是否有关联订单
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async hasOrders(id) {
    const result = await this.db
      .prepare(
        `
            SELECT COUNT(*) as count FROM orders WHERE salesperson_id = ?
        `
      )
      .bind(id)
      .first();
    return result.count > 0;
  }

  /**
   * 记录登录信息
   * @param {string} id
   * @param {string} ip
   * @param {string} device
   * @returns {Promise<boolean>}
   */
  async recordLogin(id, ip, device) {
    const result = await this.db
      .prepare(
        `
            UPDATE salespersons 
            SET last_login_at = ?, last_login_ip = ?, last_login_device = ?, updated_at = ?
            WHERE id = ?
        `
      )
      .bind(now(), ip || null, device || null, now(), id)
      .run();
    return hasChanges(result);
  }
}
