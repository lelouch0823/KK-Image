import { generateId, now } from '../api/utils/id.js';
import { executeBatchChunks } from '../lib/db/batch.js';

/**
 * 多级价格规则仓库
 * 支持 retail（零售价）、wholesale（批发价）、vip（VIP 价）三种价格类型
 * 每个变体每种类型最多一条规则
 */
export class PriceRuleRepository {
  /**
   * 构造函数
   * @param {D1Database} db - Cloudflare D1 数据库实例
   * @param {object} [deps={}] - 依赖注入
   */
  constructor(db, deps = {}) {
    this.db = db;
  }

  /**
   * 查询变体的所有价格规则
   * @param {string} variantId
   * @returns {Promise<Array>}
   */
  async findByVariant(variantId) {
    const result = await this.db
      .prepare('SELECT * FROM price_rules WHERE variant_id = ? ORDER BY price_type ASC')
      .bind(variantId)
      .all();
    return result?.results || [];
  }

  /**
   * 按变体 ID 列表批量查询价格规则
   * @param {string[]} variantIds
   * @returns {Promise<Map<string, Array>>} variantId -> priceRules[]
   */
  async findByVariantIds(variantIds = []) {
    const map = new Map();
    const ids = [
      ...new Set(
        (Array.isArray(variantIds) ? variantIds : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      ),
    ];
    if (ids.length === 0) return map;

    // D1 参数上限安全处理
    const chunkSize = 98;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const result = await this.db
        .prepare(
          `SELECT * FROM price_rules WHERE variant_id IN (${placeholders}) ORDER BY variant_id, price_type ASC`
        )
        .bind(...chunk)
        .all();
      for (const row of result?.results || []) {
        const vid = String(row.variant_id || '');
        if (!map.has(vid)) map.set(vid, []);
        map.get(vid).push(row);
      }
    }
    return map;
  }

  /**
   * 查询变体指定类型的当前有效价格规则
   * 考虑 valid_from / valid_to 时间窗口
   * @param {string} variantId
   * @param {string} priceType
   * @returns {Promise<object|null>}
   */
  async findActiveByType(variantId, priceType) {
    const currentTime = now();
    const row = await this.db
      .prepare(
        `SELECT * FROM price_rules
                 WHERE variant_id = ? AND price_type = ?
                   AND (valid_from IS NULL OR valid_from <= ?)
                   AND (valid_to IS NULL OR valid_to >= ?)
                 LIMIT 1`
      )
      .bind(variantId, priceType, currentTime, currentTime)
      .first();
    return row || null;
  }

  /**
   * 获取变体当前生效的价格（优先级：price_rules > variant base price）
   * @param {string} variantId
   * @param {string} priceType
   * @param {number} fallbackPrice - 变体基础价格
   * @returns {Promise<number>}
   */
  async getActivePrice(variantId, priceType, fallbackPrice = 0) {
    const rule = await this.findActiveByType(variantId, priceType);
    if (rule && rule.price !== null && rule.price !== undefined) {
      return Number(rule.price);
    }
    // 没有规则时回退到 retail 类型的规则
    if (priceType !== 'retail') {
      const retailRule = await this.findActiveByType(variantId, 'retail');
      if (retailRule && retailRule.price !== null && retailRule.price !== undefined) {
        return Number(retailRule.price);
      }
    }
    return Number(fallbackPrice) || 0;
  }

  /**
   * 创建或更新价格规则（基于 variant_id + price_type 唯一约束）
   * @param {string} variantId
   * @param {string} priceType
   * @param {number} price
   * @param {number|null} validFrom
   * @param {number|null} validTo
   * @returns {Promise<object>}
   */
  async upsert(variantId, priceType, price, validFrom = null, validTo = null) {
    const id = generateId();
    const timestamp = now();
    await this.db
      .prepare(
        `INSERT INTO price_rules (id, variant_id, price_type, price, valid_from, valid_to, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(variant_id, price_type) DO UPDATE SET
                    price = excluded.price,
                    valid_from = excluded.valid_from,
                    valid_to = excluded.valid_to,
                    updated_at = excluded.updated_at`
      )
      .bind(id, variantId, priceType, Number(price), validFrom, validTo, timestamp, timestamp)
      .run();
    return {
      id,
      variant_id: variantId,
      price_type: priceType,
      price: Number(price),
      valid_from: validFrom,
      valid_to: validTo,
      updated_at: timestamp,
    };
  }

  /**
   * 批量 upsert 价格规则
   * @param {Array<{variantId: string, priceType: string, price: number, validFrom?: number|null, validTo?: number|null}>} rules
   * @returns {Promise<object[]>}
   */
  async upsertBatch(rules = []) {
    const results = [];
    const timestamp = now();
    const statements = [];

    for (const rule of rules) {
      const id = generateId();
      statements.push(
        this.db
          .prepare(
            `INSERT INTO price_rules (id, variant_id, price_type, price, valid_from, valid_to, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON CONFLICT(variant_id, price_type) DO UPDATE SET
                            price = excluded.price,
                            valid_from = excluded.valid_from,
                            valid_to = excluded.valid_to,
                            updated_at = excluded.updated_at`
          )
          .bind(
            id,
            rule.variantId,
            rule.priceType,
            Number(rule.price),
            rule.validFrom ?? null,
            rule.validTo ?? null,
            timestamp,
            timestamp
          )
      );
      results.push({
        id,
        variant_id: rule.variantId,
        price_type: rule.priceType,
        price: Number(rule.price),
        valid_from: rule.validFrom ?? null,
        valid_to: rule.validTo ?? null,
        updated_at: timestamp,
      });
    }

    if (statements.length > 0) {
      await executeBatchChunks(this.db, statements);
    }
    return results;
  }

  /**
   * 删除价格规则
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const result = await this.db.prepare('DELETE FROM price_rules WHERE id = ?').bind(id).run();
    return Number(result?.meta?.changes || 0) > 0;
  }

  /**
   * 删除变体的所有价格规则
   * @param {string} variantId
   * @returns {Promise<number>} 删除数量
   */
  async deleteByVariant(variantId) {
    const result = await this.db
      .prepare('DELETE FROM price_rules WHERE variant_id = ?')
      .bind(variantId)
      .run();
    return Number(result?.meta?.changes || 0);
  }

  /**
   * 按产品 ID 查询所有变体的价格规则
   * @param {string} productId
   * @returns {Promise<Map<string, Array>>} variantId -> priceRules[]
   */
  async findByProductId(productId) {
    const result = await this.db
      .prepare(
        `SELECT pr.* FROM price_rules pr
                 JOIN product_variants pv ON pv.id = pr.variant_id
                 WHERE pv.product_id = ?
                 ORDER BY pr.variant_id, pr.price_type ASC`
      )
      .bind(productId)
      .all();
    const map = new Map();
    for (const row of result?.results || []) {
      const vid = String(row.variant_id || '');
      if (!map.has(vid)) map.set(vid, []);
      map.get(vid).push(row);
    }
    return map;
  }
}
