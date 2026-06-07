/**
 * 库存预警看板仓库 (Inventory Dashboard Repository)
 * ================================================
 *
 * 聚合库存预警、零库存、库存变动等数据，为库存预警看板提供数据支撑。
 *
 * @module repositories/InventoryDashboardRepository
 */

import { buildVariantDisplayName } from '../lib/utils/variant-meta.js';
import { parseJsonObject } from '../api/utils/json.js';

export class InventoryDashboardRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 获取库存预警看板摘要
   * - totalSkus: 活跃变体总数
   * - lowStockCount: 低库存（可用 < 预警阈值）变体数
   * - zeroStockCount: 零库存（可用 = 0）变体数
   * - totalInventoryValue: 总库存价值（on_hand * cost_price 求和）
   */
  async getSummary() {
    const row = await this.db
      .prepare(
        `
      SELECT
        COUNT(*) AS total_skus,
        SUM(CASE WHEN COALESCE(ib.available, pv.stock_quantity, 0) < COALESCE(pv.alert_threshold, 10)
            AND COALESCE(ib.available, pv.stock_quantity, 0) > 0 THEN 1 ELSE 0 END) AS low_stock_count,
        SUM(CASE WHEN COALESCE(ib.available, pv.stock_quantity, 0) = 0 THEN 1 ELSE 0 END) AS zero_stock_count,
        COALESCE(SUM(COALESCE(ib.on_hand, pv.stock_quantity, 0) * COALESCE(pv.cost_price, 0)), 0) AS total_inventory_value
      FROM product_variants pv
      LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
      WHERE pv.status = 'active'
    `
      )
      .bind()
      .first();

    return {
      totalSkus: row?.total_skus || 0,
      lowStockCount: row?.low_stock_count || 0,
      zeroStockCount: row?.zero_stock_count || 0,
      totalInventoryValue: Math.round((row?.total_inventory_value || 0) * 100) / 100,
    };
  }

  /**
   * 获取低库存商品列表（available < alert_threshold 且 available > 0）
   */
  async getLowStockItems(limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const { results } = await this.db
      .prepare(
        `
      SELECT
        pv.id AS variant_id,
        pv.product_id,
        p.name AS product_name,
        pv.sku,
        pv.options_values,
        COALESCE(ib.available, pv.stock_quantity, 0) AS available,
        COALESCE(ib.on_hand, pv.stock_quantity, 0) AS on_hand,
        COALESCE(ib.reserved, 0) AS reserved,
        COALESCE(pv.alert_threshold, 10) AS alert_threshold
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
      WHERE pv.status = 'active'
        AND COALESCE(ib.available, pv.stock_quantity, 0) < COALESCE(pv.alert_threshold, 10)
        AND COALESCE(ib.available, pv.stock_quantity, 0) > 0
      ORDER BY (COALESCE(ib.available, pv.stock_quantity, 0) * 1.0 / COALESCE(pv.alert_threshold, 10)) ASC
      LIMIT ?
    `
      )
      .bind(safeLimit)
      .all();

    return (results || []).map((row) => {
      const optionsValues = parseJsonObject(row.options_values, {});
      return {
        variantId: row.variant_id,
        productId: row.product_id,
        productName: row.product_name,
        sku: row.sku,
        variantLabel: buildVariantDisplayName(optionsValues),
        available: row.available,
        onHand: row.on_hand,
        reserved: row.reserved,
        alertThreshold: row.alert_threshold,
      };
    });
  }

  /**
   * 获取零库存商品列表（available = 0）
   */
  async getZeroStockItems(limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const { results } = await this.db
      .prepare(
        `
      SELECT
        pv.id AS variant_id,
        pv.product_id,
        p.name AS product_name,
        pv.sku,
        pv.options_values,
        COALESCE(ib.on_hand, pv.stock_quantity, 0) AS on_hand,
        COALESCE(ib.reserved, 0) AS reserved
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
      WHERE pv.status = 'active'
        AND COALESCE(ib.available, pv.stock_quantity, 0) = 0
      ORDER BY p.name ASC, pv.sku ASC
      LIMIT ?
    `
      )
      .bind(safeLimit)
      .all();

    return (results || []).map((row) => {
      const optionsValues = parseJsonObject(row.options_values, {});
      return {
        variantId: row.variant_id,
        productId: row.product_id,
        productName: row.product_name,
        sku: row.sku,
        variantLabel: buildVariantDisplayName(optionsValues),
        onHand: row.on_hand,
        reserved: row.reserved,
      };
    });
  }

  /**
   * 获取最近库存变动（最近 10 条）
   */
  async getRecentMovements(limit = 10) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const { results } = await this.db
      .prepare(
        `
      SELECT
        ie.id,
        ie.variant_id,
        ie.event_type,
        ie.quantity_delta,
        ie.occurred_at,
        pv.sku,
        p.name AS product_name,
        pv.options_values
      FROM inventory_events ie
      LEFT JOIN product_variants pv ON pv.id = ie.variant_id
      LEFT JOIN products p ON p.id = pv.product_id
      ORDER BY ie.occurred_at DESC
      LIMIT ?
    `
      )
      .bind(safeLimit)
      .all();

    return (results || []).map((row) => {
      const optionsValues = parseJsonObject(row.options_values, {});
      return {
        id: row.id,
        variantId: row.variant_id,
        eventType: row.event_type,
        quantityDelta: row.quantity_delta,
        occurredAt: row.occurred_at,
        sku: row.sku,
        productName: row.product_name || '-',
        variantLabel: buildVariantDisplayName(optionsValues),
      };
    });
  }

  /**
   * 获取近 30 天出库最多商品（出库量 top 10）
   */
  async getTopMovingItems(days = 30, limit = 10) {
    const safeDays = Math.max(Number(days) || 30, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    // 使用当前时间戳减去天数（毫秒）
    const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;

    const { results } = await this.db
      .prepare(
        `
      SELECT
        ie.variant_id,
        pv.sku,
        p.name AS product_name,
        pv.options_values,
        SUM(ABS(ie.quantity_delta)) AS total_outbound
      FROM inventory_events ie
      LEFT JOIN product_variants pv ON pv.id = ie.variant_id
      LEFT JOIN products p ON p.id = pv.product_id
      WHERE ie.event_type IN ('order_shipment', 'inventory_allocated_to_order_line')
        AND ie.quantity_delta < 0
        AND ie.occurred_at >= ?
      GROUP BY ie.variant_id
      ORDER BY total_outbound DESC
      LIMIT ?
    `
      )
      .bind(cutoff, safeLimit)
      .all();

    return (results || []).map((row) => {
      const optionsValues = parseJsonObject(row.options_values, {});
      return {
        variantId: row.variant_id,
        sku: row.sku,
        productName: row.product_name || '-',
        variantLabel: buildVariantDisplayName(optionsValues),
        totalOutbound: row.total_outbound || 0,
      };
    });
  }
}
