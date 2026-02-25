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
    const dateStr = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
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
        product_images: this._parseJson(item.product_images),
        product_specifications: this._parseJson(item.product_specifications),
        variant_options: this._parseJson(item.variant_options),
      })),
    };
  }

  /**
   * 列表查询 (带分页和状态筛选)
   */
  async list(filters = {}) {
    const { status, page = 1, limit = 20 } = filters;
    const safePage = Math.max(1, Math.floor(Number(page)));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit))));

    let where = '1=1';
    const params = [];

    if (status) {
      where += ' AND status = ?';
      params.push(status);
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
      .bind(...params, safeLimit, (safePage - 1) * safeLimit)
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
    const sets = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updateData), id];

    const result = await this.db
      .prepare(`UPDATE purchase_orders SET ${sets} WHERE id = ?`)
      .bind(...values)
      .run();

    return result.meta?.changes > 0;
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

    return result.meta?.changes > 0;
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
  async removeItem(itemId) {
    const result = await this.db
      .prepare(`DELETE FROM purchase_order_items WHERE id = ?`)
      .bind(itemId)
      .run();
    return result.meta?.changes > 0;
  }

  /**
   * 更新单条明细项（数量/单价）
   * @param {string} itemId - 明细 ID
   * @param {Object} updates - { quantity?, unit_cost? }
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateItem(itemId, updates) {
    const fields = [];
    const values = [];

    if (updates.quantity !== undefined) { fields.push('quantity = ?'); values.push(updates.quantity); }
    if (updates.unit_cost !== undefined) { fields.push('unit_cost = ?'); values.push(updates.unit_cost); }
    if (updates.variant_id !== undefined) { fields.push('variant_id = ?'); values.push(updates.variant_id === '' ? null : updates.variant_id); }

    if (fields.length === 0) return false;

    values.push(itemId);
    const result = await this.db.prepare(
      `UPDATE purchase_order_items SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return (result.meta?.changes || 0) > 0;
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

  _parseJson(str) {
    try {
      return typeof str === 'string' ? JSON.parse(str) : (str || []);
    } catch {
      return [];
    }
  }
}
