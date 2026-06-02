/**
 * 库存盘点仓储 (Stocktake Repository)
 * ====================================
 *
 * 负责盘点单的 CRUD 操作、盘点明细管理、库存调整。
 * 遵循项目 Repository 模式，只做数据访问，不做业务逻辑。
 *
 * @module repositories/StocktakeRepository
 */

import { generateId, now } from '../api/utils/id.js';
import { executeBatchChunks } from '../lib/db/batch.js';

export class StocktakeRepository {
  constructor(db) {
    this.db = db;
  }

  // ─── 盘点单 CRUD ─────────────────────────────────────────

  /**
   * 创建盘点单并自动填充当前库存快照
   * @param {Object} data - { notes, createdBy }
   * @returns {Promise<Object>} 创建的盘点单（含 items）
   */
  async create(data = {}) {
    const id = generateId();
    const timestamp = now();

    // 查询所有活跃变体的当前库存
    const { results: variants = [] } = await this.db.prepare(`
      SELECT
        pv.id AS variant_id,
        COALESCE(ib.on_hand, pv.stock_quantity, 0) AS system_qty
      FROM product_variants pv
      LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
      WHERE pv.status = 'active'
      ORDER BY pv.created_at ASC
    `).bind().all();

    // 批量构建 statements
    const statements = [];

    // 插入盘点单主表
    statements.push(
      this.db.prepare(
        `INSERT INTO stocktakes (id, status, notes, created_at, created_by)
         VALUES (?, 'draft', ?, ?, ?)`
      ).bind(id, data.notes || null, timestamp, data.createdBy || null)
    );

    // 插入盘点明细（每个活跃变体一行）
    for (const v of variants) {
      statements.push(
        this.db.prepare(
          `INSERT INTO stocktake_items (id, stocktake_id, variant_id, system_qty)
           VALUES (?, ?, ?, ?)`
        ).bind(generateId(), id, v.variant_id, v.system_qty)
      );
    }

    await executeBatchChunks(this.db, statements);

    return {
      id,
      status: 'draft',
      notes: data.notes || null,
      createdBy: data.createdBy || null,
      createdAt: timestamp,
      completedAt: null,
      itemCount: variants.length,
    };
  }

  /**
   * 查询盘点单列表
   * @param {Object} filters - { status, page, limit }
   * @returns {Promise<{ items: Array, total: number }>}
   */
  async list(filters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(Math.max(1, Number(filters.limit) || 20), 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (filters.status) {
      conditions.push('s.status = ?');
      params.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.db.prepare(
      `SELECT COUNT(*) as total FROM stocktakes s ${whereClause}`
    ).bind(...params).first();

    const { results = [] } = await this.db.prepare(`
      SELECT
        s.*,
        COUNT(si.id) AS item_count,
        SUM(CASE WHEN si.actual_qty IS NOT NULL THEN 1 ELSE 0 END) AS counted_items,
        SUM(CASE WHEN si.difference IS NOT NULL AND si.difference != 0 THEN 1 ELSE 0 END) AS diff_items
      FROM stocktakes s
      LEFT JOIN stocktake_items si ON si.stocktake_id = s.id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    return {
      items: results.map(row => ({
        id: row.id,
        status: row.status,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        itemCount: row.item_count || 0,
        countedItems: row.counted_items || 0,
        diffItems: row.diff_items || 0,
      })),
      total: countResult?.total || 0,
    };
  }

  /**
   * 查询盘点单详情（含明细）
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    if (!id) return null;

    const stocktake = await this.db.prepare(
      'SELECT * FROM stocktakes WHERE id = ?'
    ).bind(id).first();

    if (!stocktake) return null;

    const { results: items = [] } = await this.db.prepare(`
      SELECT
        si.*,
        pv.sku,
        p.name AS product_name,
        pv.options_values
      FROM stocktake_items si
      JOIN product_variants pv ON pv.id = si.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE si.stocktake_id = ?
      ORDER BY p.name ASC, pv.sku ASC
    `).bind(id).all();

    return {
      id: stocktake.id,
      status: stocktake.status,
      notes: stocktake.notes,
      createdBy: stocktake.created_by,
      createdAt: stocktake.created_at,
      completedAt: stocktake.completed_at,
      items: items.map(item => ({
        id: item.id,
        variantId: item.variant_id,
        sku: item.sku,
        productName: item.product_name,
        optionsValues: item.options_values,
        systemQty: item.system_qty,
        actualQty: item.actual_qty,
        difference: item.difference,
        notes: item.notes,
      })),
    };
  }

  /**
   * 更新盘点单备注
   * @param {string} id
   * @param {Object} data - { notes }
   * @returns {Promise<boolean>}
   */
  async update(id, data = {}) {
    if (!id) return false;
    const updates = [];
    const values = [];

    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes);
    }

    if (updates.length === 0) return false;

    values.push(id);
    const result = await this.db.prepare(
      `UPDATE stocktakes SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return result?.meta?.changes > 0;
  }

  /**
   * 更新盘点明细的实际数量
   * @param {string} stocktakeId
   * @param {Array<{ itemId, actualQty, notes }>} updates
   * @returns {Promise<number>} 更新行数
   */
  async updateItems(stocktakeId, updates = []) {
    if (!stocktakeId || !Array.isArray(updates) || updates.length === 0) return 0;

    // 验证盘点单状态
    const stocktake = await this.db.prepare(
      'SELECT status FROM stocktakes WHERE id = ?'
    ).bind(stocktakeId).first();

    if (!stocktake || (stocktake.status !== 'draft' && stocktake.status !== 'counting')) {
      throw new Error('盘点单状态不允许修改明细');
    }

    // 如果是 draft 状态，自动切换到 counting
    if (stocktake.status === 'draft') {
      await this.db.prepare(
        "UPDATE stocktakes SET status = 'counting' WHERE id = ? AND status = 'draft'"
      ).bind(stocktakeId).run();
    }

    // 批量获取所有需要更新的 item 的 system_qty，避免 N+1 查询
    const itemIds = updates
      .map(u => u.itemId)
      .filter(Boolean);
    const placeholders = itemIds.map(() => '?').join(',');
    const { results: existingItems = [] } = itemIds.length > 0
      ? await this.db.prepare(
          `SELECT id, system_qty FROM stocktake_items WHERE id IN (${placeholders}) AND stocktake_id = ?`
        ).bind(...itemIds, stocktakeId).all()
      : { results: [] };
    const systemQtyMap = new Map(existingItems.map(item => [item.id, item.system_qty]));

    const statements = [];
    for (const update of updates) {
      const actualQty = Number(update.actualQty);
      if (!Number.isFinite(actualQty)) continue;

      const systemQty = systemQtyMap.get(update.itemId);
      if (systemQty === undefined) continue;

      const difference = actualQty - systemQty;

      const setClauses = ['actual_qty = ?', 'difference = ?'];
      const values = [actualQty, difference];

      if (update.notes !== undefined) {
        setClauses.push('notes = ?');
        values.push(update.notes);
      }

      statements.push(
        this.db.prepare(
          `UPDATE stocktake_items SET ${setClauses.join(', ')} WHERE id = ? AND stocktake_id = ?`
        ).bind(...values, update.itemId, stocktakeId)
      );
    }

    if (statements.length === 0) return 0;
    await executeBatchChunks(this.db, statements);
    return statements.length;
  }

  /**
   * 执行库存调整（根据盘点差异创建 inventory_events）
   * @param {string} stocktakeId
   * @param {Object} options - { adjustedBy }
   * @returns {Promise<{ adjustedCount: number, totalDelta: number }>}
   */
  async adjustInventory(stocktakeId, options = {}) {
    if (!stocktakeId) throw new Error('stocktakeId is required');

    const stocktake = await this.db.prepare(
      'SELECT status FROM stocktakes WHERE id = ?'
    ).bind(stocktakeId).first();

    if (!stocktake) throw new Error('盘点单不存在');
    if (stocktake.status !== 'counting') {
      throw new Error('盘点单状态不允许调整库存');
    }

    // 获取有差异的明细
    const { results: items = [] } = await this.db.prepare(`
      SELECT si.variant_id, si.system_qty, si.actual_qty, si.difference
      FROM stocktake_items si
      WHERE si.stocktake_id = ? AND si.actual_qty IS NOT NULL AND si.difference != 0
    `).bind(stocktakeId).all();

    if (items.length === 0) {
      // 没有差异，直接标记为已完成
      await this.db.prepare(
        "UPDATE stocktakes SET status = 'adjusted', completed_at = ? WHERE id = ?"
      ).bind(now(), stocktakeId).run();
      return { adjustedCount: 0, totalDelta: 0 };
    }

    const timestamp = now();
    const statements = [];

    for (const item of items) {
      const delta = item.difference;

      // 更新 product_variants.stock_quantity
      statements.push(
        this.db.prepare(
          `UPDATE product_variants
           SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ?
           WHERE id = ?`
        ).bind(delta, timestamp, item.variant_id)
      );

      // 更新 inventory_balances
      statements.push(
        this.db.prepare(
          `INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at)
           VALUES (?, MAX(0, ?), 0, MAX(0, ?), ?)
           ON CONFLICT(variant_id) DO UPDATE SET
             on_hand = MAX(0, inventory_balances.on_hand + ?),
             available = MAX(0, MAX(0, inventory_balances.on_hand + ?) - inventory_balances.reserved),
             updated_at = excluded.updated_at`
        ).bind(
          item.variant_id,
          delta,
          delta,
          timestamp,
          delta,
          delta
        )
      );

      // 写入 inventory_ledger
      statements.push(
        this.db.prepare(
          `INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at)
           VALUES (?, ?, 'manual_adjustment', ?, 'stocktake', ?, ?, ?, ?)`
        ).bind(
          generateId(),
          item.variant_id,
          delta,
          stocktakeId,
          timestamp,
          JSON.stringify({ source: 'stocktake', stocktakeId }),
          timestamp
        )
      );

      // 写入 inventory_events
      statements.push(
        this.db.prepare(
          `INSERT INTO inventory_events (id, variant_id, event_type, quantity_delta, source_type, source_id, metadata, occurred_at, created_at)
           VALUES (?, ?, 'manual_adjustment', ?, 'stocktake', ?, ?, ?, ?)`
        ).bind(
          generateId(),
          item.variant_id,
          delta,
          stocktakeId,
          JSON.stringify({ source: 'stocktake', stocktakeId }),
          timestamp,
          timestamp
        )
      );
    }

    // 更新盘点单状态
    statements.push(
      this.db.prepare(
        "UPDATE stocktakes SET status = 'adjusted', completed_at = ? WHERE id = ?"
      ).bind(timestamp, stocktakeId)
    );

    await executeBatchChunks(this.db, statements);

    return {
      adjustedCount: items.length,
      totalDelta: items.reduce((sum, item) => sum + Math.abs(item.difference), 0),
    };
  }

  /**
   * 取消盘点单
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async cancel(id) {
    if (!id) return false;

    const stocktake = await this.db.prepare(
      'SELECT status FROM stocktakes WHERE id = ?'
    ).bind(id).first();

    if (!stocktake) throw new Error('盘点单不存在');
    if (stocktake.status === 'adjusted') {
      throw new Error('已调整的盘点单不能取消');
    }

    const result = await this.db.prepare(
      "UPDATE stocktakes SET status = 'cancelled' WHERE id = ? AND status != 'adjusted'"
    ).bind(id).run();

    return result?.meta?.changes > 0;
  }
}
