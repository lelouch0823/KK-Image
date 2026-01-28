import { generateId, generateShareToken, hashPassword, now } from '../api/utils/id.js';

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
    return result.success && result.meta.changes > 0;
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
    const offset = (page - 1) * limit;
    let whereClause = '1=1';
    const bindings = [];

    if (search) {
      whereClause += ' AND (name LIKE ? OR store LIKE ? OR phone LIKE ?)';
      const term = `%${search}%`;
      bindings.push(term, term, term);
    }

    const [countResult, listResult] = await Promise.all([
      this.db
        .prepare(
          `
                SELECT COUNT(*) as total FROM salespersons WHERE ${whereClause}
            `
        )
        .bind(...bindings)
        .first(),
      this.db
        .prepare(
          `
                SELECT 
                    s.*,
                    (SELECT COUNT(*) FROM orders WHERE salesperson_id = s.id) as order_count
                FROM salespersons s
                WHERE ${whereClause} 
                ORDER BY s.created_at DESC 
                LIMIT ? OFFSET ?
            `
        )
        .bind(...bindings, limit, offset)
        .all(),
    ]);

    return {
      results: listResult.results,
      total: countResult.total,
      pages: Math.ceil(countResult.total / limit),
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
                    INSERT INTO salespersons (id, name, store, phone, access_token, password_hash, plain_password, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                `
          )
          .bind(
            id,
            name.trim(),
            store || null,
            phone || null,
            accessToken,
            passwordHash,
            password,
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
    const updates = [];
    const values = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name.trim());
    }
    if (data.store !== undefined) {
      updates.push('store = ?');
      values.push(data.store || null);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?');
      values.push(data.phone || null);
    }
    if (data.password) {
      const passwordHash = await hashPassword(data.password, this.jwtSecret);
      updates.push('password_hash = ?');
      values.push(passwordHash);
      updates.push('plain_password = ?');
      values.push(data.password);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }

    if (updates.length === 0) return false;

    updates.push('updated_at = ?');
    values.push(now());
    values.push(id);

    const result = await this.db
      .prepare(
        `
            UPDATE salespersons SET ${updates.join(', ')} WHERE id = ?
        `
      )
      .bind(...values)
      .run();

    return result.success;
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
    return result.success && result.meta.changes > 0;
  }

  /**
   * 重置 Token
   * @param {string} id
   * @returns {Promise<string>} New token
   */
  async resetToken(id) {
    const newToken = generateShareToken(12);
    const result = await this.db
      .prepare(
        `
            UPDATE salespersons SET access_token = ?, updated_at = ? WHERE id = ?
        `
      )
      .bind(newToken, now(), id)
      .run();

    if (result.meta.changes === 0) throw new Error('Salesperson not found');
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
}
