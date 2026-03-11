import { parseRepoPagination } from '../api/utils/pagination.js';
import { parseJsonArray, parseJsonObject } from '../api/utils/json.js';
import { buildSetClause } from '../api/utils/sql.js';
import { hasChanges } from '../api/utils/result.js';

/**
 * 采购单仓储 (Purchase Order Repository)
 * ========================================
 *
 * 负责采购单的 CRUD 操作、明细管理、编号生成及成本查询。
 * 遵循项目 Repository 模式，只做数据访问，不做业务逻辑。
 *
 * @module repositories/PurchaseOrderRepository
 */

export class PurchaseOrderRepository {
  constructor(db) {
    this.db = db;
  }

  // ─── 编号生成 ───────────────────────────────────────────

  /**
   * 生成采购单号 PO-YYYYMMDD-NNN
   */
  async generatePoNo() {
    const now = new Date();
    // 使用中国时区
    now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
      .replace(/\//g, '')
      .replace(/(\d{4})(\d{1,2})(\d{1,2})/, (_, y, m, d) => `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`);

    // 简化：直接用 YYYYMMDD 格式
    const year = now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric' });
    const month = now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai', month: '2-digit' });
    const day = now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai', day: '2-digit' });
    const prefix = `PO-${year}${month}${day}`;

    const result = await this.db
      .prepare(`SELECT COUNT(*) as count FROM purchase_orders WHERE po_no LIKE ?`)
      .bind(`${prefix}%`)
      .first();

    const seq = (result?.count || 0) + 1;
    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  // ─── 主表 CRUD ─────────────────────────────────────────

  /**
   * 创建采购单
   * @param {Object} data - { remark, currency, allocation_method, estimated_shipping_cost, estimated_tariff_cost }
   * @returns {Promise<Object>} 创建的采购单
   */
  async create(data) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const poNo = await this.generatePoNo();

    await this.db.prepare(`
      INSERT INTO purchase_orders (id, po_no, status, estimated_shipping_cost, estimated_tariff_cost, currency, allocation_method, remark, created_at, updated_at)
      VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      poNo,
      data.estimated_shipping_cost || 0,
      data.estimated_tariff_cost || 0,
      data.currency || 'CNY',
      data.allocation_method || 'by_quantity',
      data.remark || null,
      now,
      now
    ).run();

    return { id, po_no: poNo, status: 'draft', created_at: now };
  }

  /**
   * 根据 ID 查找采购单 (含明细)
   */
  async findById(id) {
    const po = await this.db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).bind(id).first();
    if (!po) return null;

    const { results: items } = await this.db.prepare(`
      SELECT 
        poi.*,
        p.name AS product_name,
        p.spu AS product_sku,
        p.brand AS product_brand,
        p.images AS product_images,
        p.specifications AS product_specifications,
        v.sku AS variant_sku,
        v.options_values AS variant_options,
        o.order_no AS customer_order_no
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      LEFT JOIN product_variants v ON poi.variant_id = v.id
      LEFT JOIN orders o ON poi.pre_order_id = o.id
      ORDER BY poi.created_at ASC
    `).bind().all();

    // 过滤当前采购单的明细
    const poItems = items.filter(item => item.po_id === id);

    return {
      ...po,
      items: poItems.map(item => ({
        ...item,
        product_images: parseJsonArray(item.product_images, []),
        product_specifications: parseJsonObject(item.product_specifications, {}),
        variant_options: parseJsonObject(item.variant_options, {}),
      })),
    };
  }

  /**
   * 列表查询 (带分页和状态筛选)
   */
  async list(filters = {}) {
    const { status, search = '', page = 1, limit = 20 } = filters;
    const { page: safePage, limit: safeLimit, offset } = parseRepoPagination(
      { page, limit },
      { defaultPage: 1, defaultLimit: 20, maxLimit: 100 }
    );

    let where = '1=1';
    const params = [];

    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      where += ' AND (po_no LIKE ? OR remark LIKE ?)';
      const like = `%${String(search).trim()}%`;
      params.push(like, like);
    }

    // 统计总数
    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as total FROM purchase_orders WHERE ${where}`)
      .bind(...params)
      .first();

    // 查询列表
    const { results } = await this.db
      .prepare(`
        SELECT po.*,
          (SELECT COALESCE(SUM(quantity), 0) FROM purchase_order_items WHERE po_id = po.id) AS item_count,
          (SELECT COALESCE(SUM(quantity * unit_cost), 0) FROM purchase_order_items WHERE po_id = po.id) AS total_goods_cost
        FROM purchase_orders po
        WHERE ${where}
        ORDER BY po.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...params, safeLimit, offset)
      .all();

    return {
      items: results,
      total: countResult?.total || 0,
      page: safePage,
      limit: safeLimit,
    };
  }

  /**
   * 更新采购单基本信息
   */
  async update(id, updates) {
    const allowedFields = [
      'remark', 'currency', 'allocation_method',
      'estimated_shipping_cost', 'estimated_tariff_cost',
      'actual_shipping_cost', 'actual_tariff_cost',
    ];

    const updateData = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) return false;

    updateData.updated_at = Date.now();
    const { clause, values } = buildSetClause(updateData);

    const result = await this.db
      .prepare(`UPDATE purchase_orders SET ${clause} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return hasChanges(result);
  }

  /**
   * 更新采购单状态
   */
  async updateStatus(id, newStatus) {
    const extra = newStatus === 'completed' ? ', completed_at = ?' : '';
    const params = newStatus === 'completed'
      ? [newStatus, Date.now(), Date.now(), id]
      : [newStatus, Date.now(), id];

    const result = await this.db
      .prepare(`UPDATE purchase_orders SET status = ?, updated_at = ?${extra} WHERE id = ?`)
      .bind(...params)
      .run();

    return hasChanges(result);
  }

  /**
   * CAS 方式更新采购单状态
   * 仅当当前状态匹配时更新成功，用于防并发重复流转
   */
  async updateStatusIfCurrent(id, currentStatus, nextStatus) {
    const extra = nextStatus === 'completed' ? ', completed_at = ?' : '';
    const now = Date.now();
    const params = nextStatus === 'completed'
      ? [nextStatus, now, now, id, currentStatus]
      : [nextStatus, now, id, currentStatus];

    const result = await this.db
      .prepare(`UPDATE purchase_orders SET status = ?, updated_at = ?${extra} WHERE id = ? AND status = ?`)
      .bind(...params)
      .run();

    return hasChanges(result);
  }

  // ─── 明细操作 ──────────────────────────────────────────

  /**
   * 批量添加明细
   * @param {string} poId
   * @param {Array<{product_id, pre_order_id, quantity, unit_cost}>} items
   */
  async addItems(poId, items) {
    if (!items || items.length === 0) return [];

    const now = Date.now();
    const stmts = [];
    const createdIds = [];

    for (const item of items) {
      if (!item.product_id) {
        throw new Error('product_id is required');
      }
      if (!item.variant_id) {
        throw new Error('variant_id is required');
      }
      const id = crypto.randomUUID();
      createdIds.push(id);

      stmts.push(
        this.db.prepare(`
          INSERT INTO purchase_order_items (id, po_id, product_id, variant_id, pre_order_id, quantity, unit_cost, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          poId,
          item.product_id,
          item.variant_id,
          item.pre_order_id || null,
          item.quantity || 1,
          item.unit_cost || 0,
          now
        )
      );
    }

    // SOTA: 使用 D1 batch 批量插入
    await this.db.batch(stmts);

    // 同步更新采购单的 updated_at
    await this.db
      .prepare(`UPDATE purchase_orders SET updated_at = ? WHERE id = ?`)
      .bind(now, poId)
      .run();

    return createdIds;
  }

  /**
   * 删除单条明细
   */
  async removeItem(poIdOrItemId, itemIdMaybe) {
    const useScopedDelete = typeof itemIdMaybe === 'string';
    const sql = useScopedDelete
      ? `DELETE FROM purchase_order_items WHERE id = ? AND po_id = ?`
      : `DELETE FROM purchase_order_items WHERE id = ?`;
    const params = useScopedDelete
      ? [itemIdMaybe, poIdOrItemId]
      : [poIdOrItemId];

    const result = await this.db
      .prepare(sql)
      .bind(...params)
      .run();
    return hasChanges(result);
  }

  /**
   * 更新单条明细项（数量/单价）
   * @param {string} itemId - 明细 ID
   * @param {Object} updates - { quantity?, unit_cost? }
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateItem(poIdOrItemId, itemIdOrUpdates, updatesMaybe) {
    const scoped = updatesMaybe !== undefined;
    const poId = scoped ? poIdOrItemId : null;
    const itemId = scoped ? itemIdOrUpdates : poIdOrItemId;
    const updates = scoped ? updatesMaybe : itemIdOrUpdates;

    const fields = [];
    const values = [];

    if (updates.quantity !== undefined) { fields.push('quantity = ?'); values.push(updates.quantity); }
    if (updates.unit_cost !== undefined) { fields.push('unit_cost = ?'); values.push(updates.unit_cost); }
    if (updates.variant_id !== undefined) { fields.push('variant_id = ?'); values.push(updates.variant_id === '' ? null : updates.variant_id); }

    if (fields.length === 0) return false;

    const where = scoped ? 'WHERE id = ? AND po_id = ?' : 'WHERE id = ?';
    if (scoped) {
      values.push(itemId, poId);
    } else {
      values.push(itemId);
    }
    const result = await this.db.prepare(
      `UPDATE purchase_order_items SET ${fields.join(', ')} ${where}`
    ).bind(...values).run();

    return hasChanges(result);
  }

  /**
   * 获取采购单的所有关联预订单 ID
   */
  async getLinkedOrderIds(poId) {
    const { results } = await this.db
      .prepare(`SELECT DISTINCT pre_order_id FROM purchase_order_items WHERE po_id = ? AND pre_order_id IS NOT NULL`)
      .bind(poId)
      .all();
    return results.map(r => r.pre_order_id);
  }

  /**
   * 获取采购单明细 (含商品信息，用于成本分摊计算)
   */
  async getItemsForAllocation(poId) {
    const { results } = await this.db.prepare(`
      SELECT poi.*, 
        COALESCE(vagg.min_cost_price, 0) AS product_cost_price, 
        v.cost_price AS variant_cost_price
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      LEFT JOIN product_variants v ON poi.variant_id = v.id
      LEFT JOIN (
        SELECT product_id, MIN(COALESCE(cost_price, 0)) AS min_cost_price
        FROM product_variants
        GROUP BY product_id
      ) vagg ON vagg.product_id = p.id
      WHERE poi.po_id = ?
    `).bind(poId).all();
    return results;
  }

  /**
   * 获取每个变体最近一次已完成采购单的成交单价
   * @param {string[]} variantIds
   * @returns {Promise<Record<string, number>>}
   */
  async getLastPurchasePricesByVariant(variantIds = []) {
    if (!variantIds || variantIds.length === 0) return {};

    const placeholders = variantIds.map(() => '?').join(',');
    const { results } = await this.db.prepare(`
      SELECT latest.variant_id, poi.unit_cost AS last_purchase_price
      FROM (
        SELECT poi2.variant_id,
               MAX(COALESCE(po2.completed_at, po2.updated_at, po2.created_at, 0)) AS latest_ts
        FROM purchase_order_items poi2
        JOIN purchase_orders po2 ON po2.id = poi2.po_id
        WHERE po2.status = 'completed'
          AND poi2.variant_id IN (${placeholders})
        GROUP BY poi2.variant_id
      ) latest
      JOIN purchase_order_items poi ON poi.variant_id = latest.variant_id
      JOIN purchase_orders po ON po.id = poi.po_id
      WHERE po.status = 'completed'
        AND COALESCE(po.completed_at, po.updated_at, po.created_at, 0) = latest.latest_ts
    `).bind(...variantIds).all();

    const map = {};
    for (const row of results) {
      if (map[row.variant_id] == null) {
        map[row.variant_id] = Number(row.last_purchase_price) || 0;
      }
    }
    return map;
  }

  /**
   * 批量更新明细的分摊费用
   * @param {Array<{id, allocated_freight, allocated_tariff}>} allocations
   */
  async updateAllocations(allocations) {
    if (!allocations || allocations.length === 0) return;

    const stmts = allocations.map(a =>
      this.db.prepare(`
        UPDATE purchase_order_items SET allocated_freight = ?, allocated_tariff = ? WHERE id = ?
      `).bind(a.allocated_freight, a.allocated_tariff, a.id)
    );

    await this.db.batch(stmts);
  }

  // ─── 统计查询 ──────────────────────────────────────────

  /**
   * 获取采购统计概览
   */
  async getStats() {
    const result = await this.db.prepare(`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft_count,
        COUNT(CASE WHEN status = 'ordered' THEN 1 END) AS ordered_count,
        COUNT(CASE WHEN status = 'shipping' THEN 1 END) AS shipping_count,
        COUNT(CASE WHEN status = 'arrived' THEN 1 END) AS arrived_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_count
      FROM purchase_orders
    `).first();
    return result;
  }

  // ─── 内部工具 ──────────────────────────────────────────
}
