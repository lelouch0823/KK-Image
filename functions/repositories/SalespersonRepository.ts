import { generateId, generateShareToken, hashPassword, verifyPassword, passwordHashNeedsMigration, now } from '../api/utils/id.js';
import { parseRepoPagination } from '../api/utils/pagination.js';
import { hasChanges } from '../api/utils/result.js';
import { buildSetClause } from '../api/utils/sql.js';
import type { D1Database } from '../types/database.js';
import type {
  SalespersonRow,
  CreateSalespersonData,
  UpdateSalespersonData,
  SalespersonRankingItem,
} from '../types/entities.js';

/**
 * 销售人员仓库
 * 处理销售人员的 CRUD、鉴权和密码管理
 */
export class SalespersonRepository {
  protected db: D1Database;
  protected jwtSecret: string;

  /**
   * 构造函数
   * @param db Cloudflare D1 数据库实例
   * @param deps 依赖注入
   * @param deps.jwtSecret JWT 密钥，用于密码哈希
   * @param deps.now 时间戳函数，默认 Date.now
   */
  constructor(db: D1Database, deps: { jwtSecret?: string; now?: () => number } | string = {}) {
    this.db = db;
    // 向后兼容：支持直接传入 jwtSecret 字符串
    if (typeof deps === 'string') {
      this.jwtSecret = deps;
    } else {
      this.jwtSecret = deps.jwtSecret || '';
    }
  }

  /**
   * 根据 ID 查找销售人员
   * @param id 销售人员 ID
   * @returns 销售人员对象，不存在时返回 null
   */
  async findById(id: string): Promise<SalespersonRow | null> {
    return await this.db
      .prepare(
        `
            SELECT * FROM salespersons WHERE id = ?
        `
      )
      .bind(id)
      .first<SalespersonRow>();
  }

  /**
   * 根据 AccessToken 查找销售人员
   * @param token 访问令牌
   * @returns 销售人员对象，不存在时返回 null
   */
  async findByToken(token: string): Promise<SalespersonRow | null> {
    return await this.db
      .prepare(
        `
            SELECT * FROM salespersons WHERE access_token = ?
        `
      )
      .bind(token)
      .first<SalespersonRow>();
  }

  /**
   * 根据微信 OpenID 查找销售人员
   * @param openid 微信 OpenID
   * @returns 销售人员对象，不存在时返回 null
   */
  async findByWechatOpenid(openid: string): Promise<SalespersonRow | null> {
    return await this.db
      .prepare('SELECT * FROM salespersons WHERE wechat_openid = ?')
      .bind(openid)
      .first<SalespersonRow>();
  }

  /**
   * 绑定微信 OpenID 到销售人员
   * @param id 销售人员 ID
   * @param openid 微信 OpenID
   * @returns 是否成功
   */
  async updateWechatOpenid(id: string, openid: string): Promise<boolean> {
    const result = await this.db
      .prepare('UPDATE salespersons SET wechat_openid = ?, updated_at = ? WHERE id = ?')
      .bind(openid, now(), id)
      .run();
    if (hasChanges(result)) return true;
    const existing = await this.db.prepare('SELECT id FROM salespersons WHERE id = ?').bind(id).first();
    return Boolean(existing);
  }

  /**
   * 获取销售人员列表 (分页)
   * @param params 分页与搜索参数
   * @returns 分页结果
   */
  async list({ page = 1, limit = 50, search = '' }: { page?: number; limit?: number; search?: string }): Promise<{ results: SalespersonRow[]; total: number; pages: number }> {
    const { limit: safeLimit, offset } = parseRepoPagination(
      { page, limit },
      { defaultPage: 1, defaultLimit: 50, maxLimit: 100 }
    );

    let whereClause = '1=1';
    const bindings: unknown[] = [];

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
        .first<{ total: number }>(),
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
        .all<SalespersonRow & { order_count: number }>(),
    ]);

    return {
      results: listResult.results,
      total: countResult!.total,
      pages: Math.ceil(countResult!.total / safeLimit),
    };
  }

  /**
   * 创建销售人员
   * @param data 销售人员数据
   * @returns 创建的销售人员信息
   */
  async create({ name, store, phone, password }: CreateSalespersonData): Promise<{ id: string; name: string; store: string | undefined; phone: string | undefined; accessToken: string; accessUrl: string }> {
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
        if ((e as Error).message.includes('UNIQUE constraint failed') && retries > 1) {
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
   * @param id 销售人员 ID
   * @param data 更新数据
   * @returns 是否成功
   */
  async update(id: string, data: UpdateSalespersonData): Promise<boolean> {
    const updateData: Record<string, unknown> = {};

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

    if (hasChanges(result)) return true;
    const existing = await this.db.prepare('SELECT id FROM salespersons WHERE id = ?').bind(id).first();
    return Boolean(existing);
  }

  /**
   * 删除销售人员
   * @param id 销售人员 ID
   * @returns 是否成功
   */
  async delete(id: string): Promise<boolean> {
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
   * @param id 销售人员 ID
   * @returns 新的访问令牌
   */
  async resetAccessToken(id: string): Promise<string> {
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
   * @param id 销售人员 ID
   * @returns 是否有订单
   */
  async hasOrders(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        `
            SELECT COUNT(*) as count FROM orders WHERE salesperson_id = ?
        `
      )
      .bind(id)
      .first<{ count: number }>();
    return result!.count > 0;
  }

  /**
   * 记录登录信息
   * @param id 销售人员 ID
   * @param ip 登录 IP
   * @param device 登录设备
   * @returns 是否成功
   */
  async recordLogin(id: string, ip: string, device: string): Promise<boolean> {
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

  /**
   * 验证密码并在需要时自动迁移哈希格式
   * @param salespersonId 销售人员 ID
   * @param password 原始密码
   * @param encodedHash 存储的密码哈希
   * @returns 密码是否匹配
   */
  async verifyAndMigratePassword(salespersonId: string, password: string, encodedHash: string): Promise<boolean> {
    const matches = await verifyPassword(password, encodedHash, this.jwtSecret);
    if (!matches) return false;

    if (passwordHashNeedsMigration(encodedHash)) {
      const upgradedHash = await hashPassword(password, this.jwtSecret);
      await this.db.prepare('UPDATE salespersons SET password_hash = ?, updated_at = ? WHERE id = ?')
        .bind(upgradedHash, now(), salespersonId)
        .run();
    }
    return true;
  }

  /**
   * 获取销售业绩排行榜
   * @param params 排行参数
   * @returns 排行数据
   */
  async getRanking({ days, sortBy = 'order_count', limit = 20 }: { days?: number; sortBy?: string; limit?: number } = {}): Promise<SalespersonRankingItem[]> {
    const safeLimit = Math.max(1, Math.min(100, limit || 20));

    // 构建时间过滤条件
    let timeFilter = '';
    const bindings: unknown[] = [];
    if (days && [7, 30, 90].includes(days)) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      timeFilter = 'AND o.created_at >= ?';
      bindings.push(cutoff);
    }

    // 排序字段映射
    const sortColumn = sortBy === 'avg_monthly' ? 'avg_monthly' : 'order_count';

    // 计算销售人员的活跃月数用于平均值
    const sql = `
      SELECT
        s.id,
        s.name,
        s.store,
        COALESCE(oc.order_count, 0) AS order_count,
        CASE
          WHEN COALESCE(oc.order_count, 0) = 0 THEN 0
          ELSE ROUND(
            CAST(COALESCE(oc.order_count, 0) AS REAL) /
            MAX(1, CAST((julianday('now') - julianday(s.created_at / 1000, 'unixepoch')) / 30.0 AS INTEGER)),
            2
          )
        END AS avg_monthly
      FROM salespersons s
      LEFT JOIN (
        SELECT salesperson_id, COUNT(*) AS order_count
        FROM orders o
        WHERE 1=1 ${timeFilter}
        GROUP BY salesperson_id
      ) oc ON oc.salesperson_id = s.id
      WHERE s.is_active = 1
      ORDER BY ${sortColumn} DESC, s.name ASC
      LIMIT ?
    `;

    const result = await this.db
      .prepare(sql)
      .bind(...bindings, safeLimit)
      .all<SalespersonRankingItem>();

    return result.results || [];
  }
}
