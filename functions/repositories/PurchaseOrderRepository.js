import { buildSetClause } from '../api/utils/sql.js';
import { hasChanges } from '../api/utils/result.js';
import { executeBatchChunks } from '../lib/db/batch.js';
// Read-model shaping is delegated to ./purchase-order-read-model.js.
// Snapshot normalization is delegated to ./purchase-order-snapshot.js.
// Snapshot hydration is delegated to ./purchase-order-item-snapshots.js.
import {
  findActiveBindingsByPreOrderIds,
  getLastPurchasePricesByVariant,
  getLinkedOrderIds,
} from "./purchase-order-links.js";
import {
  generatePurchaseOrderNo,
  isPurchaseOrderNoConflictError,
} from './purchase-order-numbering.js';
import {
  findPurchaseOrderDetail,
  getPurchaseOrderItemsForAllocation,
  getPurchaseOrderStats,
  listPurchaseOrders,
} from './purchase-order-queries.js';
import {
  addPurchaseOrderItems,
  removePurchaseOrderItem,
  updatePurchaseOrderItem,
} from './purchase-order-item-mutations.js';

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
  async generatePoNo(_options = undefined) {
    return generatePurchaseOrderNo(this.db);
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

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const poNo = await this.generatePoNo();

      try {
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
      } catch (error) {
        if (!isPurchaseOrderNoConflictError(error) || attempt === 4) {
          throw error;
        }
      }
    }

    throw new Error('failed to create purchase order');
  }

  async deleteIfEmptyDraft(id) {
    const result = await this.db.prepare(`
      DELETE FROM purchase_orders
      WHERE id = ?
        AND status = 'draft'
        AND NOT EXISTS (
          SELECT 1
          FROM purchase_order_items
          WHERE po_id = ?
        )
    `).bind(id, id).run();

    return hasChanges(result);
  }

  /**
   * 根据 ID 查找采购单 (含明细)
   */
  async findById(id, _options = undefined) {
    return findPurchaseOrderDetail({ db: this.db, id });
  }

  /**
   * 列表查询 (带分页和状态筛选)
   */
  async list(filters = {}, _options = undefined) {
    return listPurchaseOrders({ db: this.db, filters });
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
    const extra = nextStatus === 'completed'
      ? ', completed_at = ?'
      : currentStatus === 'completed'
        ? ', completed_at = NULL'
        : '';
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
  async addItems(poId, items, _options = undefined) {
    return addPurchaseOrderItems({ db: this.db, poId, items });
  }

  /**
   * 删除单条明细
   */
  async removeItem(poIdOrItemId, itemIdMaybe, _options = undefined) {
    return removePurchaseOrderItem({ db: this.db, poIdOrItemId, itemIdMaybe });
  }

  /**
   * 获取单条采购单明细
   * @param {string} poId
   * @param {string} itemId
   * @returns {Promise<Object|null>}
   */
  async findItemById(poId, itemId) {
    return this.db
      .prepare(
        `SELECT id, po_id, product_id, variant_id, pre_order_id, order_line_id, quantity, unit_cost
         FROM purchase_order_items
         WHERE id = ? AND po_id = ?`
      )
      .bind(itemId, poId)
      .first();
  }

  /**
   * 更新单条明细项（数量/单价）
   * @param {string} itemId - 明细 ID
   * @param {Object} updates - { quantity?, unit_cost? }
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateItem(poIdOrItemId, itemIdOrUpdates, updatesMaybe, _options = undefined) {
    return updatePurchaseOrderItem({
      db: this.db,
      poIdOrItemId,
      itemIdOrUpdates,
      updatesMaybe,
    });
  }

  /**
   * 获取采购单的所有关联预订单 ID
   */
  async getLinkedOrderIds(poId) {
    return getLinkedOrderIds({ db: this.db, poId });
  }

  async findActiveBindingsByPreOrderIds(preOrderIds = []) {
    return findActiveBindingsByPreOrderIds({ db: this.db, preOrderIds });
  }

  /**
   * 获取采购单明细 (含商品信息，用于成本分摊计算)
   */
  async getItemsForAllocation(poId) {
    return getPurchaseOrderItemsForAllocation({ db: this.db, poId });
  }

  /**
   * 获取每个变体最近一次已完成采购单的成交单价
   * @param {string[]} variantIds
   * @returns {Promise<Record<string, number>>}
   */
  async getLastPurchasePricesByVariant(variantIds = []) {
    return getLastPurchasePricesByVariant({ db: this.db, variantIds });
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
  async getStats(_options = undefined) {
    return getPurchaseOrderStats({ db: this.db });
  }

  // ─── 内部工具 ──────────────────────────────────────────
}
