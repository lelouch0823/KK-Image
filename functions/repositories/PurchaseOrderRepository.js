import { parseRepoPagination } from '../api/utils/pagination.js';
import { parseJsonArray, parseJsonObject } from '../api/utils/json.js';
import { buildSetClause } from '../api/utils/sql.js';
import { hasChanges } from '../api/utils/result.js';

function toNumber(value) {
  return Number(value || 0);
}

function projectPurchaseOrderDisplayStatus(progress = {}) {
  const ordered = toNumber(progress.ordered_qty);
  const received = toNumber(progress.received_qty);
  const cancelled = toNumber(progress.cancelled_qty);
  const outstanding = progress.outstanding_qty != null
    ? toNumber(progress.outstanding_qty)
    : Math.max(ordered - received - cancelled, 0);

  if (ordered > 0 && cancelled >= ordered) return 'cancelled';
  if (ordered > 0 && outstanding <= 0) return 'received';
  if (received > 0) return 'partially_received';
  return 'open';
}

function normalizePurchaseOrderProgress(row = {}) {
  return {
    ...row,
    item_count: toNumber(row.item_count),
    ordered_qty: toNumber(row.ordered_qty),
    received_qty: toNumber(row.received_qty),
    cancelled_qty: toNumber(row.cancelled_qty),
    outstanding_qty: toNumber(row.outstanding_qty),
    total_goods_cost: toNumber(row.total_goods_cost),
    receipt_count: toNumber(row.receipt_count),
    display_status: row.display_status || projectPurchaseOrderDisplayStatus(row),
  };
}

function summarizePurchaseOrderItems(items = []) {
  return normalizePurchaseOrderProgress(items.reduce((acc, item) => ({
    item_count: acc.item_count + 1,
    ordered_qty: acc.ordered_qty + toNumber(item.quantity),
    received_qty: acc.received_qty + toNumber(item.received_qty),
    cancelled_qty: acc.cancelled_qty + toNumber(item.cancelled_qty),
    outstanding_qty:
      acc.outstanding_qty + Math.max(toNumber(item.quantity) - toNumber(item.received_qty) - toNumber(item.cancelled_qty), 0),
    total_goods_cost: acc.total_goods_cost + (toNumber(item.quantity) * toNumber(item.unit_cost)),
    receipt_count: acc.receipt_count + toNumber(item.receipt_count),
    last_received_at: Math.max(acc.last_received_at, toNumber(item.last_received_at)),
  }), {
    item_count: 0,
    ordered_qty: 0,
    received_qty: 0,
    cancelled_qty: 0,
    outstanding_qty: 0,
    total_goods_cost: 0,
    receipt_count: 0,
    last_received_at: 0,
  }));
}

const D1_MAX_IN_CLAUSE_SIZE = 100;

function chunkArray(items = [], chunkSize = D1_MAX_IN_CLAUSE_SIZE) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function executeBatchChunks(db, statements = []) {
  for (const chunk of chunkArray(statements)) {
    await db.batch(chunk);
  }
}

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
        o.order_no AS customer_order_no,
        COALESCE(pr.receipt_count, 0) AS receipt_count,
        pr.last_received_at AS last_received_at
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      LEFT JOIN product_variants v ON poi.variant_id = v.id
      LEFT JOIN orders o ON poi.pre_order_id = o.id
      LEFT JOIN (
        SELECT
          purchase_order_item_id,
          COUNT(*) AS receipt_count,
          MAX(received_at) AS last_received_at
        FROM purchase_receipts
        GROUP BY purchase_order_item_id
      ) pr ON pr.purchase_order_item_id = poi.id
      WHERE poi.po_id = ?
      ORDER BY poi.created_at ASC
    `).bind(id).all();

    const poItems = (items || []).map(item => ({
      ...item,
      quantity: toNumber(item.quantity),
      received_qty: toNumber(item.received_qty),
      cancelled_qty: toNumber(item.cancelled_qty),
      receipt_count: toNumber(item.receipt_count),
      product_images: parseJsonArray(item.product_images, []),
      product_specifications: parseJsonObject(item.product_specifications, {}),
      variant_options: parseJsonObject(item.variant_options, {}),
    }));
    const { results: receipts } = await this.db.prepare(`
      SELECT
        pr.*,
        p.name AS product_name,
        p.brand AS product_brand,
        p.spu AS product_sku,
        v.sku AS variant_sku,
        v.options_values AS variant_options,
        COALESCE(rr.reversed_qty, 0) AS reversed_qty,
        COALESCE(rr.reversal_count, 0) AS reversal_count,
        rr.last_reversed_at AS last_reversed_at
      FROM purchase_receipts pr
      LEFT JOIN products p ON p.id = pr.product_id
      LEFT JOIN product_variants v ON v.id = pr.variant_id
      LEFT JOIN (
        SELECT
          original_receipt_id,
          COALESCE(SUM(reversal_qty), 0) AS reversed_qty,
          COUNT(*) AS reversal_count,
          MAX(created_at) AS last_reversed_at
        FROM purchase_receipt_reversals
        GROUP BY original_receipt_id
      ) rr ON rr.original_receipt_id = pr.id
      WHERE pr.purchase_order_id = ?
      ORDER BY pr.received_at DESC, pr.created_at DESC
    `).bind(id).all();
    const receiptRows = (receipts || []).map((receipt) => {
      const normalizedReceipt = normalizePurchaseOrderProgress({
        ...receipt,
        received_qty: toNumber(receipt.received_qty),
      });
      const reversedQty = toNumber(receipt.reversed_qty);
      const receivedQty = toNumber(receipt.received_qty);
      const availableReversalQty = Math.max(receivedQty - reversedQty, 0);
      return {
        ...normalizedReceipt,
        reversed_qty: reversedQty,
        reversal_count: toNumber(receipt.reversal_count),
        last_reversed_at: toNumber(receipt.last_reversed_at),
        available_reversal_qty: availableReversalQty,
        is_reversed: reversedQty > 0 || toNumber(receipt.reversal_count) > 0,
        product_images: parseJsonArray(receipt.product_images, []),
        variant_options: parseJsonObject(receipt.variant_options, {}),
      };
    });
    const progress = summarizePurchaseOrderItems(poItems);

    return {
      ...po,
      ...progress,
      items: poItems,
      receipts: receiptRows,
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
          COALESCE(agg.item_count, 0) AS item_count,
          COALESCE(agg.ordered_qty, 0) AS ordered_qty,
          COALESCE(agg.received_qty, 0) AS received_qty,
          COALESCE(agg.cancelled_qty, 0) AS cancelled_qty,
          COALESCE(agg.outstanding_qty, 0) AS outstanding_qty,
          COALESCE(agg.total_goods_cost, 0) AS total_goods_cost,
          CASE
            WHEN COALESCE(agg.ordered_qty, 0) > 0 AND COALESCE(agg.cancelled_qty, 0) >= COALESCE(agg.ordered_qty, 0) THEN 'cancelled'
            WHEN COALESCE(agg.ordered_qty, 0) > 0 AND COALESCE(agg.outstanding_qty, 0) <= 0 THEN 'received'
            WHEN COALESCE(agg.received_qty, 0) > 0 THEN 'partially_received'
            ELSE 'open'
          END AS display_status
        FROM purchase_orders po
        LEFT JOIN (
          SELECT
            po_id,
            COUNT(*) AS item_count,
            COALESCE(SUM(quantity), 0) AS ordered_qty,
            COALESCE(SUM(received_qty), 0) AS received_qty,
            COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty,
            COALESCE(SUM(MAX(quantity - received_qty - cancelled_qty, 0)), 0) AS outstanding_qty,
            COALESCE(SUM(quantity * unit_cost), 0) AS total_goods_cost
          FROM purchase_order_items
          GROUP BY po_id
        ) agg ON agg.po_id = po.id
        WHERE ${where}
        ORDER BY po.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...params, safeLimit, offset)
      .all();

    return {
      items: results.map((row) => normalizePurchaseOrderProgress(row)),
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

    await executeBatchChunks(this.db, stmts);

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

    const map = {};
    for (const variantIdChunk of chunkArray(variantIds)) {
      const placeholders = variantIdChunk.map(() => '?').join(',');
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
      `).bind(...variantIdChunk).all();

      for (const row of results || []) {
        if (map[row.variant_id] == null) {
          map[row.variant_id] = Number(row.last_purchase_price) || 0;
        }
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

    await executeBatchChunks(this.db, stmts);
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
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_count,
        COALESCE((SELECT SUM(quantity) FROM purchase_order_items), 0) AS ordered_qty,
        COALESCE((SELECT SUM(received_qty) FROM purchase_order_items), 0) AS received_qty,
        COALESCE((SELECT SUM(cancelled_qty) FROM purchase_order_items), 0) AS cancelled_qty,
        COALESCE((SELECT SUM(MAX(quantity - received_qty - cancelled_qty, 0)) FROM purchase_order_items), 0) AS outstanding_qty
      FROM purchase_orders
    `).first();
    return normalizePurchaseOrderProgress(result || {});
  }

  // ─── 内部工具 ──────────────────────────────────────────
}
